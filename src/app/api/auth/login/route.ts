import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    // 临时允许 admin@crm.com 直接登录
    if (email === 'admin@crm.com') {
      return NextResponse.json({
        success: true,
        message: "登录成功",
        token: "temp-admin-token"
      });
    }

    return NextResponse.json(
      { success: false, error: "账号或密码错误" },
      { status: 401 }
    );
  } catch (err) {
    console.error("登录接口错误:", err);
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}
