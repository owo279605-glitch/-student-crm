import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseCredentials } from '@/storage/database/supabase-client';

// 调试端点 - 检查数据库实际状态
export async function GET() {
  try {
    const client = getSupabaseClient();
    const { url } = getSupabaseCredentials();

    // 脱敏显示数据库URL
    const sanitizedUrl = url.replace(/(https?:\/\/)([^.]+)(\.supabase\.co.*)/, '$1***$3');

    // 直接查询总数
    const { count, error } = await client
      .from('students')
      .select('*', { count: 'exact', head: true });

    // 获取所有学员姓名（用于检查重复）
    const { data: allNames } = await client
      .from('students')
      .select('name');

    // 检查重复姓名
    const nameCounts: Record<string, number> = {};
    allNames?.forEach((s) => {
      nameCounts[s.name] = (nameCounts[s.name] || 0) + 1;
    });

    const duplicates = Object.entries(nameCounts)
      .filter(([, cnt]) => cnt > 1)
      .map(([name, cnt]) => ({ name, count: cnt }));

    return NextResponse.json({
      total: count,
      error: error?.message,
      nameListLength: allNames?.length,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 10), // 只返回前10个重复项
      timestamp: new Date().toISOString(),
      dbUrl: sanitizedUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
