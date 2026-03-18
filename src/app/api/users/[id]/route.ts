import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hashPassword } from '@/lib/auth';

// 更新用户（仅管理员）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { userId, ...updateFields } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const client = getSupabaseClient();

    // 验证是否是管理员
    const { data: currentUser } = await client
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updateFields.name !== undefined) updateData.name = updateFields.name;
    if (updateFields.role !== undefined) updateData.role = updateFields.role;
    if (updateFields.subject !== undefined) updateData.subject = updateFields.subject || null;
    if (updateFields.isActive !== undefined) updateData.is_active = updateFields.isActive;
    if (updateFields.password) {
      updateData.password = await hashPassword(updateFields.password as string);
    }

    const { data, error } = await client
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, name, role, subject, is_active, created_at')
      .single();

    if (error) {
      console.error('Update user error:', error);
      return NextResponse.json(
        { error: '更新用户失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: '更新用户失败' },
      { status: 500 }
    );
  }
}

// 删除用户（仅管理员）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 尝试解析body，如果没有body则返回空对象
    let body: { userId?: string } = {};
    try {
      const text = await request.text();
      if (text && text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      console.error('Failed to parse request body');
    }
    
    const { userId } = body;
    
    console.log('Delete user request:', { userId, body });
    
    if (!userId) {
      return NextResponse.json(
        { error: '未登录或会话已过期，请重新登录' },
        { status: 401 }
      );
    }

    const client = getSupabaseClient();

    // 验证是否是管理员
    const { data: currentUser, error: userError } = await client
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Get current user error:', userError);
    }

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '无权限，只有管理员可以删除用户' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 不能删除自己
    if (id === userId) {
      return NextResponse.json(
        { error: '不能删除自己的账号' },
        { status: 400 }
      );
    }
    
    const { error } = await client
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete user error:', error);
      return NextResponse.json(
        { error: '删除用户失败: ' + error.message },
        { status: 500 }
      );
    }

    console.log('User deleted successfully:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    );
  }
}
