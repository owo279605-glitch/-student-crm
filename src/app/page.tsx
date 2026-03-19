'use client';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">初中学员档案表 🎉</h1>
        <div className="border rounded p-4">
          <h2 className="text-lg font-semibold mb-2">学员列表</h2>
          <p className="text-slate-500">这里是你的学员管理页面，登录已自动跳过！</p>
          {/* 这里可以后续加学员增删改查功能 */}
        </div>
      </div>
    </div>
  );
}
