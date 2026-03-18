import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 调试接口：检查学员的观看进度数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subject = searchParams.get('subject');
    const lecture = searchParams.get('lecture');
    const showAll = searchParams.get('showAll') === 'true';
    const raw = searchParams.get('raw') === 'true'; // 返回原始数据

    const client = getSupabaseClient();

    // 查询学员数据
    let query = client
      .from('students')
      .select('id, name, user_id, subject, undertaker, lecture_progress')
      .limit(100);

    // 只显示有user_id的学员（除非showAll=true）
    if (!showAll) {
      query = query.not('user_id', 'is', null);
    }

    // 如果指定学科，筛选学科
    if (subject) {
      query = query.ilike('subject', `%${subject}%`);
    }

    const { data: students, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: '查询失败: ' + error.message },
        { status: 500 }
      );
    }

    // 如果请求原始数据，直接返回
    if (raw) {
      return NextResponse.json({
        success: true,
        count: students?.length || 0,
        samples: students?.slice(0, 10).map(s => ({
          name: s.name,
          user_id: s.user_id,
          subject: s.subject,
          lecture_progress: s.lecture_progress,
          lecture_progress_type: typeof s.lecture_progress,
        })),
      });
    }

    // 统计观看进度
    const progressStats = {
      total: students?.length || 0,
      withProgress: 0,
      bySubject: {} as Record<string, number>,
      byLecture: {} as Record<number, number>,
      samples: [] as Array<{
        name: string;
        user_id: string;
        subject: string;
        lecture_progress: unknown;
      }>,
    };

    students?.forEach((s) => {
      const progress = s.lecture_progress as Record<string, Record<string, boolean>> | null;
      
      if (progress && Object.keys(progress).length > 0) {
        progressStats.withProgress++;
        
        // 按学科统计
        Object.keys(progress).forEach((subj) => {
          if (!progressStats.bySubject[subj]) {
            progressStats.bySubject[subj] = 0;
          }
          progressStats.bySubject[subj]++;
          
          // 按讲座统计
          const lectures = progress[subj];
          if (lectures) {
            Object.entries(lectures).forEach(([lec, watched]) => {
              if (watched) {
                const lecNum = parseInt(lec);
                if (!progressStats.byLecture[lecNum]) {
                  progressStats.byLecture[lecNum] = 0;
                }
                progressStats.byLecture[lecNum]++;
              }
            });
          }
        });

        // 收集样本数据
        if (progressStats.samples.length < 5) {
          progressStats.samples.push({
            name: s.name,
            user_id: s.user_id || '',
            subject: s.subject || '',
            lecture_progress: progress,
          });
        }
      }
    });

    // 如果指定了讲座和学科，找出观看该讲座的学员
    const watchedList: Array<{ name: string; user_id: string; subject: string }> = [];
    if (subject && lecture) {
      students?.forEach((s) => {
        const progress = s.lecture_progress as Record<string, Record<string, boolean>> | null;
        // 同时支持字符串和数字 key
        const subjectProgress = progress?.[subject];
        if (subjectProgress) {
          const value = subjectProgress[String(lecture)] ?? subjectProgress[lecture];
          if (value === true) {
            watchedList.push({
              name: s.name,
              user_id: s.user_id || '',
              subject: s.subject || '',
            });
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      stats: progressStats,
      watchedList,
      debug: {
        subject,
        lecture,
        queryCount: students?.length || 0,
      },
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: '调试查询失败' },
      { status: 500 }
    );
  }
}
