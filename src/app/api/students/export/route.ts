import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as XLSX from 'xlsx';

// 导出学员数据为 Excel
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');

    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const client = getSupabaseClient();

    // 获取当前用户名字（用于销售筛选）
    let currentUserName: string | null = null;
    if (userRole === 'sales') {
      const { data: user } = await client
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();
      currentUserName = user?.name || null;
    }

    // 构建查询
    let query = client
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    // 销售只能导出自己承接的学员
    if (userRole === 'sales' && currentUserName) {
      query = query.ilike('undertaker', `%${currentUserName}%`);
    }

    const { data: students, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: '查询失败: ' + error.message },
        { status: 500 }
      );
    }

    if (!students || students.length === 0) {
      return NextResponse.json(
        { error: '没有可导出的数据' },
        { status: 400 }
      );
    }

    // 状态映射
    const statusMap: Record<string, string> = {
      pending: '待跟进',
      enrolled: '已报名',
      refunded: '已退费',
      lost: '已流失',
    };

    // 转换数据为导出格式
    const exportData = students.map((s, index) => {
      const progress = s.lecture_progress as Record<string, boolean> | null;
      const row: Record<string, unknown> = {
        '序号': index + 1,
        '姓名': s.name,
        '电话': s.phone || '',
        '微信': s.wechat || '',
        '来源': s.source || '',
        '课程': s.course || '',
        '学科': s.subject || '',
        '承接人': s.undertaker || '',
        '状态': statusMap[s.status] || s.status,
        '是否退费': s.is_refunded ? '是' : '否',
        '退费原因': s.refund_reason || '',
        '金额': s.amount || '',
        '备注': s.notes || '',
        '创建时间': s.created_at ? new Date(s.created_at).toLocaleString() : '',
      };

      // 添加第1讲到第15讲的观看状态
      for (let i = 1; i <= 15; i++) {
        row[`第${i}讲观看`] = progress?.[i] ? '已观看' : '未观看';
      }

      return row;
    });

    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // 设置列宽
    const colWidths = [
      { wch: 6 },   // 序号
      { wch: 10 },  // 姓名
      { wch: 15 },  // 电话
      { wch: 15 },  // 微信
      { wch: 10 },  // 来源
      { wch: 15 },  // 课程
      { wch: 15 },  // 学科
      { wch: 20 },  // 承接人
      { wch: 10 },  // 状态
      { wch: 10 },  // 是否退费
      { wch: 20 },  // 退费原因
      { wch: 10 },  // 金额
      { wch: 30 },  // 备注
      { wch: 20 },  // 创建时间
    ];
    // 添加第1-15讲的列宽
    for (let i = 0; i < 15; i++) {
      colWidths.push({ wch: 10 });
    }
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, '学员数据');

    // 生成 Excel 文件
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 返回文件
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = userRole === 'admin' 
      ? `学员数据_全部_${timestamp}.xlsx`
      : `学员数据_${currentUserName || '我'}_${timestamp}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: '导出失败: ' + String(error) },
      { status: 500 }
    );
  }
}
