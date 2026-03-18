import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 清理重复学员数据（保留最新的那条）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userRole } = body;

    if (!userId || userRole !== 'admin') {
      return NextResponse.json(
        { error: '只有管理员可以执行此操作' },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();

    // 获取所有学员数据
    const { data: allStudents, error: selectError } = await client
      .from('students')
      .select('id, name, phone, wechat, subject, undertaker, amount, created_at');

    if (selectError) {
      return NextResponse.json(
        { error: '查询失败: ' + selectError.message },
        { status: 500 }
      );
    }

    console.log(`Total records in database: ${allStudents?.length}`);

    // 创建签名来判断记录是否相同（除了ID和时间戳）
    const createSignature = (s: typeof allStudents[0]) => {
      return `${s.name}|${s.phone || ''}|${s.wechat || ''}|${s.subject || ''}|${s.undertaker || ''}|${s.amount || ''}`;
    };

    // 找出重复的记录
    const signatureMap = new Map<string, typeof allStudents>();
    allStudents?.forEach((s) => {
      const sig = createSignature(s);
      if (!signatureMap.has(sig)) {
        signatureMap.set(sig, []);
      }
      signatureMap.get(sig)!.push(s);
    });

    // 找出需要删除的ID（保留最新的）
    const idsToDelete: string[] = [];
    let duplicateGroupCount = 0;

    signatureMap.forEach((students) => {
      if (students.length > 1) {
        duplicateGroupCount++;
        // 按创建时间排序，保留最新的
        students.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        // 删除其他的
        students.slice(1).forEach((s) => {
          idsToDelete.push(s.id);
        });
      }
    });

    console.log(`Found ${idsToDelete.length} duplicate records to delete`);

    if (idsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有发现重复数据',
        total: allStudents?.length || 0,
        deleted: 0,
      });
    }

    // 批量删除（每次最多删除100条，防止超时）
    let deletedCount = 0;
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100);
      const { error: deleteError } = await client
        .from('students')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error('Delete error:', deleteError);
      } else {
        deletedCount += batch.length;
      }
    }

    // 验证清理结果
    const { count: finalCount } = await client
      .from('students')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: `已清理 ${deletedCount} 条重复数据`,
      beforeCount: allStudents?.length || 0,
      afterCount: finalCount || 0,
      deleted: deletedCount,
      duplicateGroups: duplicateGroupCount,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: '清理失败: ' + String(error) },
      { status: 500 }
    );
  }
}
