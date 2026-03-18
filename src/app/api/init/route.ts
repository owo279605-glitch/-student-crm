import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hashPassword } from '@/lib/auth';

// 初始化默认管理员账号（仅在没有用户时可用）
export async function POST() {
  try {
    const client = getSupabaseClient();
    
    // 检查是否已有用户
    const { data: existingUsers } = await client
      .from('users')
      .select('id')
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { error: '系统已初始化，无法重复创建' },
        { status: 400 }
      );
    }

    // 创建默认管理员
    const hashedPassword = await hashPassword('admin123');
    const { data, error } = await client
      .from('users')
      .insert({
        email: 'admin@crm.com',
        password: hashedPassword,
        name: '管理员',
        role: 'admin',
        is_active: true,
      })
      .select('id, email, name, role')
      .single();

    if (error) {
      console.error('Init error:', error);
      return NextResponse.json(
        { error: '初始化失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '初始化成功',
      user: data,
      defaultPassword: 'admin123',
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: '初始化失败' },
      { status: 500 }
    );
  }
}
