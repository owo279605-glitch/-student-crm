import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 批量删除学员
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, userId, userRole } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '请选择要删除的学员' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 销售只能删除自己的学员
    if (userRole === 'sales') {
      // 先检查这些学员是否都属于当前销售
      const { data: students } = await client
        .from('students')
        .select('id, sales_id')
        .in('id', ids);

      const notOwnStudents = students?.filter(s => s.sales_id !== userId) || [];
      if (notOwnStudents.length > 0) {
        return NextResponse.json(
          { error: '部分学员无权删除' },
          { status: 403 }
        );
      }
    }

    const { error } = await client
      .from('students')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Batch delete error:', error);
      return NextResponse.json(
        { error: '批量删除失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: ids.length,
    });
  } catch (error) {
    console.error('Batch delete students error:', error);
    return NextResponse.json(
      { error: '批量删除失败' },
      { status: 500 }
    );
  }
}
