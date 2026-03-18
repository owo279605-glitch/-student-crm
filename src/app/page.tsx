'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }

      // 存储用户信息到localStorage
      localStorage.setItem('crm_user', JSON.stringify(data.user));
      
      // 登录成功后跳转
      router.push('/dashboard');
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleInit = async () => {
    setInitLoading(true);
    setError('');

    try {
      const res = await fetch('/api/init', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '初始化失败');
        return;
      }

      setEmail('admin@crm.com');
      setPassword('admin123');
      setError('');
      alert(`初始化成功！\n默认账号: admin@crm.com\n默认密码: admin123`);
    } catch {
      setError('初始化失败');
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">初中学员档案表</CardTitle>
          <CardDescription>请登录您的账号</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              登录
            </Button>
          </form>
          <div className="mt-4 pt-4 border-t text-center">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleInit}
              disabled={initLoading}
            >
              {initLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              初始化管理员账号
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              首次使用请点击初始化按钮创建管理员账号
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
