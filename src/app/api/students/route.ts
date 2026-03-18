import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取学员列表（支持筛选、分页）
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');
    
    console.log('GET /api/students params:', { userId, userRole });
    
    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const client = getSupabaseClient();
    
    // 分页参数
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 获取销售列表（用于显示销售名称和下拉选择）
    let salesUsers: { id: string; name: string; subject: string | null }[] = [];
    const { data: users } = await client
      .from('users')
      .select('id, name, subject')
      .eq('is_active', true);
    salesUsers = users || [];

    // 构建查询
    let query = client
      .from('students')
      .select('*', { count: 'exact' });

    // 销售只能看到承接人包含自己名字的学员
    if (userRole === 'sales') {
      // 获取当前用户的名字
      const currentUser = salesUsers.find(u => u.id === userId);
      console.log('Current sales user:', currentUser);
      
      if (currentUser) {
        // 匹配 undertaker 字段包含当前用户名字
        console.log(`Filtering by undertaker contains: ${currentUser.name}`);
        query = query.ilike('undertaker', `%${currentUser.name}%`);
      } else {
        // 如果找不到用户，返回空结果
        console.log('User not found in salesUsers, returning empty');
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
          salesUsers: [],
        });
      }
    }

    // 筛选条件
    const name = searchParams.get('name');
    if (name) {
      query = query.ilike('name', `%${name}%`);
    }

    const phone = searchParams.get('phone');
    if (phone) {
      query = query.ilike('phone', `%${phone}%`);
    }

    const status = searchParams.get('status');
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const isRefunded = searchParams.get('isRefunded');
    if (isRefunded !== null && isRefunded !== 'all') {
      query = query.eq('is_refunded', isRefunded === 'true');
    }

    const undertakerFilter = searchParams.get('undertaker');
    if (undertakerFilter && undertakerFilter !== 'all' && userRole === 'admin') {
      query = query.ilike('undertaker', `%${undertakerFilter}%`);
    }

    // 筛选空白用户ID
    const emptyUserId = searchParams.get('emptyUserId');
    if (emptyUserId === 'true') {
      query = query.or('user_id.is.null,user_id.eq.');
    }

    // 观看进度筛选参数
    const lectures = searchParams.get('lectures'); // 逗号分隔，如 "1,2,3"
    const watched = searchParams.get('watched'); // "true" / "false" / "all"

    // 如果有观看进度筛选，需要特殊处理
    // Supabase 不支持复杂的 JSONB 查询，所以先获取所有数据再筛选
    const needLectureFilter = lectures && watched && watched !== 'all';

    // 获取当前用户的学科（用于按学科筛选观看进度）
    let currentUserSubject: string | null = null;
    if (userRole === 'sales' && userId) {
      const currentUser = salesUsers.find(u => u.id === userId);
      currentUserSubject = currentUser?.subject || null;
    }

    if (needLectureFilter) {
      // 获取所有符合其他条件的数据
      const { data: allData, error: allError, count: totalCount } = await query
        .order('created_at', { ascending: false });

      if (allError) {
        console.error('Query error:', allError);
        return NextResponse.json(
          { error: '查询失败' },
          { status: 500 }
        );
      }

      // 解析要筛选的讲座
      const lectureList = lectures.split(',').map(l => parseInt(l.trim())).filter(l => l >= 1 && l <= 15);
      const isWatched = watched === 'true';

      // 在内存中筛选 - 新的数据结构按学科存储
      const filteredData = (allData || []).filter((student) => {
        const progress = student.lecture_progress as Record<string, Record<string, boolean>> | null;
        
        // 检查所有指定的讲座是否符合条件
        return lectureList.every(lecture => {
          let hasWatched = false;
          
          if (progress) {
            // 如果是销售，只检查其负责学科的数据
            // 如果是管理员，检查所有学科
            if (currentUserSubject) {
              // 只检查该销售负责的学科
              const subjectProgress = progress[currentUserSubject];
              if (subjectProgress) {
                const value = subjectProgress[String(lecture)] ?? subjectProgress[lecture];
                if (value === true) {
                  hasWatched = true;
                }
              }
            } else {
              // 管理员：遍历所有学科
              Object.entries(progress).forEach(([subj, subjectProgress]) => {
                // 跳过无效的 key（如顶级的 "1": true 这种错误数据）
                if (!['语文', '数学', '英语'].includes(subj)) return;
                
                if (subjectProgress && typeof subjectProgress === 'object') {
                  const value = subjectProgress[String(lecture)] ?? subjectProgress[lecture];
                  if (value === true) {
                    hasWatched = true;
                  }
                }
              });
            }
          }
          
          return hasWatched === isWatched;
        });
      });

      // 分页
      const paginatedData = filteredData.slice(offset, offset + pageSize);

      return NextResponse.json({
        data: paginatedData,
        total: filteredData.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredData.length / pageSize),
        salesUsers,
        lectureFilter: { lectures: lectureList, watched: isWatched },
      });
    }

    // 排序和分页
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      );
    }

    console.log(`Query returned ${data?.length || 0} records, total: ${count}`);

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
      salesUsers,
    });
  } catch (error) {
    console.error('Get students error:', error);
    return NextResponse.json(
      { error: '获取学员列表失败' },
      { status: 500 }
    );
  }
}

// 新增学员
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userRole, ...studentData } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const client = getSupabaseClient();

    // 准备学员数据
    const insertData = {
      name: studentData.name,
      phone: studentData.phone || null,
      wechat: studentData.wechat || null,
      source: studentData.source || null,
      course: studentData.course || null,
      subject: studentData.subject || null,
      undertaker: studentData.undertaker || null,
      user_id: studentData.studentUserId || studentData.userId || null,
      status: studentData.status || 'pending',
      is_refunded: studentData.isRefunded || false,
      refund_reason: studentData.refundReason || null,
      sales_id: userRole === 'sales' ? userId : (studentData.salesId || null),
      amount: studentData.amount || null,
      notes: studentData.notes || null,
    };

    const { data, error } = await client
      .from('students')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json(
        { error: '新增学员失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json(
      { error: '新增学员失败' },
      { status: 500 }
    );
  }
}
