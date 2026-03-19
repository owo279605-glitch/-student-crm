'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@crm.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    // 🔴 关键：阻止表单默认刷新！
    e.preventDefault();
    
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      
      if (data.success) {
        // ✅ 登录成功：跳转到 dashboard
        window.location.href = '/dashboard';
      } else {
        setError(data.error || '登录失败，请稍后重试');
      }
    } catch (err) {
      console.error('登录请求异常:', err);
      setError('网络错误，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">初中学员档案表</h1>
        <p className="text-center text-slate-500 mb-6">请登录您的账号</p>
        
        {error && (
          <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
            {error}
          </div>
        )}

        {/* 🔴 必须用 onSubmit 绑定到 form 上 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-black text-white py-2 rounded-md hover:bg-slate-800 transition-colors"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  );
}
