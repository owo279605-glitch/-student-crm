import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 观看进度数据结构说明：
// lecture_progress 按学科存储，格式如下：
// {
//   "语文": { "1": true, "2": false, "3": true },
//   "数学": { "1": true, "2": true },
//   "英语": { "1": false, "2": true }
// }

// 获取观看进度统计（按销售统计）
// 每个销售只显示其负责学科的观看数据
// 整体统计按学科分开显示
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');

    console.log('[观看统计] 开始查询:', { userId, userRole });

    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const client = getSupabaseClient();

    // 获取当前用户信息
    let currentUser: { name: string; subject: string | null } | null = null;
    if (userRole === 'sales') {
      const { data: user } = await client
        .from('users')
        .select('name, subject')
        .eq('id', userId)
        .single();
      currentUser = user;
      console.log('[观看统计] 当前用户:', currentUser);
    }

    // 获取所有用户的负责学科
    const { data: allUsers } = await client
      .from('users')
      .select('name, subject');
    
    // 建立用户名到学科的映射
    const userSubjectMap = new Map<string, string | null>();
    allUsers?.forEach((u) => {
      userSubjectMap.set(u.name, u.subject);
    });

    console.log('[观看统计] 用户学科映射:', Object.fromEntries(userSubjectMap));

    // 构建查询
    let query = client
      .from('students')
      .select('undertaker, subject, lecture_progress');

    // 销售只能看到自己承接的学员
    if (userRole === 'sales' && currentUser) {
      query = query.ilike('undertaker', `%${currentUser.name}%`);
    }

    const { data: students, error } = await query;

    if (error) {
      console.error('[观看统计] 查询错误:', error);
      return NextResponse.json(
        { error: '查询失败: ' + error.message },
        { status: 500 }
      );
    }

    console.log('[观看统计] 查询到的学员数:', students?.length || 0);

    const lectureList = Array.from({ length: 15 }, (_, i) => i + 1);
    const subjects = ['语文', '数学', '英语'];

    // ==================== 按学科分开统计（核心修改）====================
    // 初始化各学科的统计数据
    const subjectStats: Record<string, {
      total: number;
      watched: Record<number, number>;
      lecturesWithData: Set<number>;
    }> = {};

    subjects.forEach(subject => {
      subjectStats[subject] = {
        total: 0,
        watched: {},
        lecturesWithData: new Set(),
      };
      lectureList.forEach(l => {
        subjectStats[subject].watched[l] = 0;
      });
    });

    // 统计各学科的观看情况
    students?.forEach((s) => {
      const studentSubject = s.subject || '';
      const progress = s.lecture_progress as Record<string, Record<string, boolean>> | null;

      // 遍历每个学科，只统计学员属于该学科的情况
      subjects.forEach(subject => {
        // 学员是否属于该学科（subject字段可能包含多个学科，如"语文,英语"）
        const belongsToSubject = studentSubject.includes(subject);
        
        if (belongsToSubject) {
          subjectStats[subject].total++;
          
          // 统计该学员在该学科的观看情况
          if (progress && progress[subject]) {
            const subjectProgress = progress[subject];
            lectureList.forEach(l => {
              const value = subjectProgress[String(l)] ?? subjectProgress[l];
              if (value === true) {
                subjectStats[subject].watched[l]++;
                subjectStats[subject].lecturesWithData.add(l);
              }
            });
          }
        }
      });
    });

    // 转换为前端需要的格式
    const subjectStatsResult: Record<string, {
      total: number;
      avgRate: number;
      watchRates: Record<number, number>;
      activeLectures: number[];
    }> = {};

    subjects.forEach(subject => {
      const stats = subjectStats[subject];
      const activeLectures = Array.from(stats.lecturesWithData).sort((a, b) => a - b);
      
      // 计算各讲的观看率
      const watchRates: Record<number, number> = {};
      lectureList.forEach(l => {
        watchRates[l] = stats.total > 0 
          ? Math.round((stats.watched[l] / stats.total) * 100) 
          : 0;
      });

      // 计算平均观看率 - 只平均有数据的讲座
      const activeLecturesCount = activeLectures.length > 0 ? activeLectures.length : 1;
      const totalWatched = activeLectures.reduce((sum, l) => sum + stats.watched[l], 0);
      const avgRate = stats.total > 0
        ? Math.round((totalWatched / (activeLecturesCount * stats.total)) * 100)
        : 0;

      subjectStatsResult[subject] = {
        total: stats.total,
        avgRate,
        watchRates,
        activeLectures,
      };
    });

    // ==================== 按销售统计（保持不变）====================
    const teacherStats: Record<string, {
      teacher: string;
      subject: string | null;
      total: number;
      watched: Record<number, number>;
    }> = {};

    students?.forEach((s) => {
      const undertaker = s.undertaker || '';
      const progress = s.lecture_progress as Record<string, Record<string, boolean>> | null;

      // 拆分承接人，每个销售单独统计
      const teachers = undertaker.split(/[,，]/).map((t: string) => t.trim()).filter((t: string) => t);
      
      if (teachers.length === 0) {
        teachers.push('未分配');
      }

      teachers.forEach((teacher: string) => {
        // 获取该销售的负责学科
        const teacherSubject = userSubjectMap.get(teacher) || null;
        
        // 生成唯一key（销售名）
        const key = teacher;

        if (!teacherStats[key]) {
          teacherStats[key] = {
            teacher,
            subject: teacherSubject,
            total: 0,
            watched: {},
          };
          lectureList.forEach(l => {
            teacherStats[key].watched[l] = 0;
          });
        }

        teacherStats[key].total++;

        // 统计观看情况 - 只统计该销售负责学科的数据
        if (teacherSubject && progress && progress[teacherSubject]) {
          // 该销售有负责学科，且学员有该学科的观看数据
          const subjectProgress = progress[teacherSubject];
          lectureList.forEach(l => {
            // 同时支持字符串和数字 key
            const value = subjectProgress[String(l)] ?? subjectProgress[l];
            if (value === true) {
              teacherStats[key].watched[l]++;
            }
          });
        }
        // 如果销售没有负责学科，或者学员没有该学科的观看数据，观看数为0
      });
    });

    // 转换为数组格式
    const teacherStatsResult = Object.values(teacherStats).map((stats) => {
      // 找出该销售负责学科的有数据讲座
      const teacherSubject = stats.subject;
      const activeLecturesForTeacher = teacherSubject 
        ? Array.from(subjectStats[teacherSubject]?.lecturesWithData || []).sort((a, b) => a - b)
        : [];
      
      const watchRates: Record<number, number> = {};
      lectureList.forEach(l => {
        watchRates[l] = stats.total > 0 
          ? Math.round((stats.watched[l] / stats.total) * 100) 
          : 0;
      });

      // 计算平均观看率 - 只平均有数据的讲座
      const activeLecturesCount = activeLecturesForTeacher.length > 0 ? activeLecturesForTeacher.length : 1;
      const totalWatched = activeLecturesForTeacher.reduce((sum, l) => sum + stats.watched[l], 0);
      const avgRate = stats.total > 0
        ? Math.round((totalWatched / (activeLecturesCount * stats.total)) * 100)
        : 0;

      return {
        teacher: stats.teacher,
        subject: stats.subject,
        total: stats.total,
        avgRate,
        watchRates,
      };
    }).sort((a, b) => a.teacher.localeCompare(b.teacher, 'zh-CN'));

    // 计算总学员数（不重复）
    const totalStudents = students?.length || 0;

    // 汇总所有有数据的讲座
    const allActiveLectures = new Set<number>();
    subjects.forEach(subject => {
      subjectStats[subject].lecturesWithData.forEach(l => allActiveLectures.add(l));
    });

    return NextResponse.json({
      teacherStats: teacherStatsResult,
      overallStats: {
        totalStudents,
        subjects: subjectStatsResult,
        activeLectures: Array.from(allActiveLectures).sort((a, b) => a - b),
      },
      lectures: lectureList,
    });
  } catch (error) {
    console.error('Lecture stats error:', error);
    return NextResponse.json(
      { error: '获取统计失败: ' + String(error) },
      { status: 500 }
    );
  }
}
