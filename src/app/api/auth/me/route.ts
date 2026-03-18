import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    // 从请求中获取cookie
    const sessionCookie = request.cookies.get('crm_session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const { userId } = JSON.parse(sessionCookie.value);
    const client = getSupabaseClient();
    
    const { data: user, error } = await client
      .from('users')
      .select('id, email, name, role')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
