import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取学员统计数据
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

    // 获取当前用户信息（名字和负责学科）
    let currentUserName: string | null = null;
    let currentUserSubject: string | null = null;
    if (userRole === 'sales') {
      const { data: user } = await client
        .from('users')
        .select('name, subject')
        .eq('id', userId)
        .single();
      currentUserName = user?.name || null;
      currentUserSubject = user?.subject || null;
    }

    // 获取按学科分类的统计
    let subjectStats: { subject: string; count: number }[] = [];
    let salesSubjectStats: { subject: string; count: number }[] = [];
    let totalForSubject = 0; // 销售负责学科的学员总数
    
    if (userRole === 'admin') {
      // 管理员看到所有学员的学科统计
      const { data: allStudents, error: studentsError } = await client
        .from('students')
        .select('subject');

      if (!studentsError && allStudents) {
        let chineseCount = 0;
        let mathCount = 0;
        let englishCount = 0;
        
        allStudents.forEach((s) => {
          const subject = s.subject || '';
          if (subject.includes('语文')) chineseCount++;
          if (subject.includes('数学')) mathCount++;
          if (subject.includes('英语')) englishCount++;
        });
        
        subjectStats = [
          { subject: '语文', count: chineseCount },
          { subject: '数学', count: mathCount },
          { subject: '英语', count: englishCount },
        ];
      }
    } else if (userRole === 'sales' && currentUserName) {
      // 销售看到自己承接学员的学科统计
      const { data: myStudents, error: studentsError } = await client
        .from('students')
        .select('subject')
        .ilike('undertaker', `%${currentUserName}%`);

      if (!studentsError && myStudents) {
        // 如果销售有分配学科，只显示该学科的统计
        if (currentUserSubject) {
          myStudents.forEach((s) => {
            const subject = s.subject || '';
            if (subject.includes(currentUserSubject)) totalForSubject++;
          });
          salesSubjectStats = [
            { subject: currentUserSubject, count: totalForSubject },
          ];
        } else {
          // 没有分配学科，显示所有学科统计
          let chineseCount = 0;
          let mathCount = 0;
          let englishCount = 0;
          
          myStudents.forEach((s) => {
            const subject = s.subject || '';
            if (subject.includes('语文')) chineseCount++;
            if (subject.includes('数学')) mathCount++;
            if (subject.includes('英语')) englishCount++;
          });
          
          salesSubjectStats = [
            { subject: '语文', count: chineseCount },
            { subject: '数学', count: mathCount },
            { subject: '英语', count: englishCount },
          ];
        }
      }
    }

    // 获取总数 - 如果销售有分配学科，只统计该学科的学员数
    let totalCount = 0;
    if (userRole === 'sales' && currentUserName && currentUserSubject) {
      // 销售有分配学科，只统计该学科
      totalCount = totalForSubject;
    } else {
      // 管理员或销售没有分配学科，统计所有学员
      let countQuery = client.from('students').select('*', { count: 'exact' });
      if (userRole === 'sales' && currentUserName) {
        countQuery = countQuery.ilike('undertaker', `%${currentUserName}%`);
      }
      const { count, error: totalError } = await countQuery;
      if (totalError) {
        console.error('Total count error:', totalError);
      }
      totalCount = count || 0;
    }

    // 获取按状态分类的统计
    let statusQuery = client.from('students').select('status');
    if (userRole === 'sales' && currentUserName) {
      statusQuery = statusQuery.ilike('undertaker', `%${currentUserName}%`);
      // 如果有分配学科，还需要过滤学科
      if (currentUserSubject) {
        statusQuery = statusQuery.ilike('subject', `%${currentUserSubject}%`);
      }
    }
    
    const { data: statusData, error: statusError } = await statusQuery;
    
    let statusStats: { status: string; count: number }[] = [];
    if (!statusError && statusData) {
      const statusCount: Record<string, number> = {};
      statusData.forEach((s) => {
        statusCount[s.status] = (statusCount[s.status] || 0) + 1;
      });
      statusStats = Object.entries(statusCount).map(([status, count]) => ({
        status,
        count,
      }));
    }

    return NextResponse.json({
      total: totalCount,
      subjectStats,
      salesSubjectStats,
      statusStats,
      currentUserName, // 返回当前用户名，方便前端显示
      currentUserSubject, // 返回当前用户负责学科
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
