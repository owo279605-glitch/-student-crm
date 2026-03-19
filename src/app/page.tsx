// 示例：找到你的登录函数，替换成这段
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault(); // 阻止表单刷新（解决「闪一下就没了」的核心！）
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
      // 登录成功后跳转到 dashboard
      window.location.href = '/dashboard';
    } else {
      alert(data.error);
    }
  } catch (err) {
    console.error("登录失败:", err);
  }
};
