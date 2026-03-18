import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hashPassword, verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: '请输入邮箱和密码' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    
    // 查询用户
    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      console.error('User not found:', { email, error });
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码 - 使用 verifyPassword 函数
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      console.error('Password mismatch for user:', email);
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    // 生成会话token
    const token = crypto.randomUUID();
    
    // 返回用户信息（不含密码）
    const { password: _, ...userWithoutPassword } = user;
    
    // 创建响应并设置cookie
    const response = NextResponse.json({
      success: true,
      user: userWithoutPassword,
    });
    
    // 设置cookie
    response.cookies.set('crm_session', JSON.stringify({ userId: user.id, token }), {
      httpOnly: true,
      secure: false, // 开发环境设为false
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
