import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 验证用户是否有效
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    const { data: user, error } = await client
      .from('users')
      .select('id, email, name, role, subject')  // 添加 subject 字段
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true, user });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
