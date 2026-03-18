import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hashPassword } from '@/lib/auth';

// 创建用户（仅管理员）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, password, name, role, subject } = body;

    console.log('Create user request:', { userId, email, name, role, subject });

    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
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
        { error: '无权限' },
        { status: 403 }
      );
    }

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '请填写完整信息' },
        { status: 400 }
      );
    }
    
    // 检查邮箱是否已存在
    const { data: existingUser } = await client
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 400 }
      );
    }

    // 创建用户
    const hashedPassword = await hashPassword(password);
    console.log('Creating user with hashed password');
    
    const { data, error } = await client
      .from('users')
      .insert({
        email,
        password: hashedPassword,
        name,
        role: role || 'sales',
        subject: subject || null,
        is_active: true,
      })
      .select('id, email, name, role, subject, is_active, created_at')
      .single();

    if (error) {
      console.error('Create user error:', error);
      return NextResponse.json(
        { error: '创建用户失败: ' + error.message },
        { status: 500 }
      );
    }

    console.log('User created successfully:', data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: '创建用户失败' },
      { status: 500 }
    );
  }
}
