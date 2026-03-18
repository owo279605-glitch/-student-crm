import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 更新学员
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { userId, userRole, ...updateFields } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const client = getSupabaseClient();

    // 检查权限：销售只能修改承接人包含自己名字的学员
    if (userRole === 'sales') {
      // 获取当前用户的名字
      const { data: currentUser } = await client
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      if (!currentUser) {
        return NextResponse.json(
          { error: '用户不存在' },
          { status: 403 }
        );
      }

      // 检查学员的承接人是否包含当前用户的名字
      const { data: student } = await client
        .from('students')
        .select('undertaker')
        .eq('id', id)
        .single();

      if (!student) {
        return NextResponse.json(
          { error: '学员不存在' },
          { status: 404 }
        );
      }

      // 检查承接人字段是否包含当前用户的名字
      const undertakers = student.undertaker?.split(/[,，]/).map((s: string) => s.trim()) || [];
      if (!undertakers.includes(currentUser.name)) {
        return NextResponse.json(
          { error: '无权限修改此学员，只有承接人可以修改' },
          { status: 403 }
        );
      }
    }

    // 准备更新数据
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updateFields.name !== undefined) updateData.name = updateFields.name;
    if (updateFields.phone !== undefined) updateData.phone = updateFields.phone || null;
    if (updateFields.wechat !== undefined) updateData.wechat = updateFields.wechat || null;
    if (updateFields.source !== undefined) updateData.source = updateFields.source || null;
    if (updateFields.course !== undefined) updateData.course = updateFields.course || null;
    if (updateFields.subject !== undefined) updateData.subject = updateFields.subject || null;
    if (updateFields.undertaker !== undefined) updateData.undertaker = updateFields.undertaker || null;
    if (updateFields.studentUserId !== undefined) updateData.user_id = updateFields.studentUserId || null;
    if (updateFields.userId !== undefined) updateData.user_id = updateFields.userId || null;
    if (updateFields.status !== undefined) updateData.status = updateFields.status;
    if (updateFields.isRefunded !== undefined) {
      updateData.is_refunded = updateFields.isRefunded;
      // 如果标记为退费，自动更新状态
      if (updateFields.isRefunded) {
        updateData.status = 'refunded';
      }
    }
    if (updateFields.refundReason !== undefined) updateData.refund_reason = updateFields.refundReason || null;
    if (updateFields.amount !== undefined) updateData.amount = updateFields.amount || null;
    if (updateFields.notes !== undefined) updateData.notes = updateFields.notes || null;
    if (updateFields.lecture_progress !== undefined) {
      updateData.lecture_progress = updateFields.lecture_progress;
    }
    if (userRole === 'admin' && updateFields.salesId !== undefined) {
      updateData.sales_id = updateFields.salesId || null;
    }

    const { data, error } = await client
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json(
        { error: '更新学员失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update student error:', error);
    return NextResponse.json(
      { error: '更新学员失败' },
      { status: 500 }
    );
  }
}

// 删除学员
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { userId, userRole } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const client = getSupabaseClient();

    // 检查权限：销售只能删除承接人包含自己名字的学员
    if (userRole === 'sales') {
      // 获取当前用户的名字
      const { data: currentUser } = await client
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      if (!currentUser) {
        return NextResponse.json(
          { error: '用户不存在' },
          { status: 403 }
        );
      }

      // 检查学员的承接人是否包含当前用户的名字
      const { data: student } = await client
        .from('students')
        .select('undertaker')
        .eq('id', id)
        .single();

      if (!student) {
        return NextResponse.json(
          { error: '学员不存在' },
          { status: 404 }
        );
      }

      // 检查承接人字段是否包含当前用户的名字
      const undertakers = student.undertaker?.split(/[,，]/).map((s: string) => s.trim()) || [];
      if (!undertakers.includes(currentUser.name)) {
        return NextResponse.json(
          { error: '无权限删除此学员，只有承接人可以删除' },
          { status: 403 }
        );
      }
    }

    const { error } = await client
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { error: '删除学员失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete student error:', error);
    return NextResponse.json(
      { error: '删除学员失败' },
      { status: 500 }
    );
  }
}
