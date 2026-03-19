import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // 直接允许 admin@crm.com 登录，跳过所有密码验证
    if (email === 'admin@crm.com') {
      return NextResponse.json({
        success: true,
        message: "登录成功",
        token: "temp-admin-token"
      });
    }

    return NextResponse.json(
      { success: false, error: "账号不存在" },
      { status: 401 }
    );
  } catch (err) {
    console.error("登录接口错误:", err);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
