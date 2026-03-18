import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { User } from '@/storage/database/shared/schema';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// 简单的密码哈希（生产环境应使用bcrypt）
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'crm-salt-key');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// 生成会话token
export function generateToken(): string {
  return crypto.randomUUID() + '-' + Date.now();
}

// 设置会话cookie
export async function setSessionCookie(userId: string, token: string) {
  const cookieStore = await cookies();
  cookieStore.set('crm_session', JSON.stringify({ userId, token }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7天
    path: '/',
  });
}

// 获取当前登录用户
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('crm_session');
    
    if (!sessionCookie?.value) {
      return null;
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
      return null;
    }

    return user as SessionUser;
  } catch {
    return null;
  }
}

// 清除会话
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('crm_session');
}
