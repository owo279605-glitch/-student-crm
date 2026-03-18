import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 观看进度数据结构说明：
// lecture_progress 按学科存储，格式如下：
// {
//   "语文": { "1": true, "2": false, "3": true },
//   "数学": { "1": true, "2": true },
//   "英语": { "1": false, "2": true }
// }

// 导入观看数据
// 参数：
// - lecture: 讲座编号 (1-15)
// - subject: 学科 (语文、数学、英语)
// - students: 学生数据数组（包含用户ID和观看时长）
// - watchedThreshold: 观看时长阈值（秒），默认600秒
// - autoCreate: 是否自动创建不存在的学员（默认true）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lecture, subject, students, watchedThreshold = 600, userId, userRole, autoCreate = false } = body;

    console.log('[导入观看数据] 开始导入:', { lecture, subject, studentCount: students?.length, watchedThreshold, autoCreate });

    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    if (!lecture || lecture < 1 || lecture > 15) {
      return NextResponse.json(
        { error: '请选择有效的讲座编号（1-15）' },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { error: '请选择学科' },
        { status: 400 }
      );
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: '没有可导入的数据' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 如果是销售，检查是否有权限导入该学科的观看数据
    if (userRole === 'sales') {
      const { data: currentUser } = await client
        .from('users')
        .select('subject')
        .eq('id', userId)
        .single();

      if (!currentUser || currentUser.subject !== subject) {
        return NextResponse.json(
          { error: `您没有权限导入"${subject}"学科的观看数据，您负责的学科是"${currentUser?.subject || '未分配'}"` },
          { status: 403 }
        );
      }
    }

    // 获取所有要导入的user_id
    const allUserIds = students
      .map((s: { userId: string }) => s.userId?.trim())
      .filter((id: string) => id);

    console.log('[导入观看数据] 提取的用户ID数量:', allUserIds.length);
    console.log('[导入观看数据] 前5个用户ID:', allUserIds.slice(0, 5));

    // 查询已存在的学员（基于user_id）
    const { data: existingStudents, error: queryError } = await client
      .from('students')
      .select('id, user_id, name, subject, lecture_progress')
      .in('user_id', allUserIds);

    if (queryError) {
      console.error('[导入观看数据] 查询错误:', queryError);
    }

    console.log('[导入观看数据] 查询到的学员数:', existingStudents?.length || 0);

    // 建立user_id到学员的映射
    const existingMap = new Map<string, { 
      id: string; 
      name: string; 
      subject: string; 
      lecture_progress: Record<string, Record<string, boolean>> 
    }>();
    existingStudents?.forEach((s) => {
      if (s.user_id) {
        existingMap.set(s.user_id, {
          id: s.id,
          name: s.name,
          subject: s.subject || '',
          lecture_progress: (s.lecture_progress as Record<string, Record<string, boolean>>) || {},
        });
      }
    });

    let updateCount = 0;
    let createCount = 0;
    let skipCount = 0;
    const updateList: string[] = [];
    const createList: string[] = [];
    const skipList: { userId: string; name: string; reason: string }[] = [];
    const failedList: { userId: string; name: string; reason: string }[] = [];

    for (const student of students) {
      const studentUserId = student.userId?.trim();
      const watchDuration = parseInt(student.watchDuration) || 0;
      const studentName = student.name || '';
      
      if (!studentUserId) continue;

      const isWatched = watchDuration >= watchedThreshold;
      const existing = existingMap.get(studentUserId);

      if (existing) {
        // ===== 学员已存在，更新观看进度 =====
        const currentSubjectProgress = existing.lecture_progress[subject] || {};
        const currentLectureStatus = currentSubjectProgress[String(lecture)] || false;
        
        // 【保护机制】只允许从"未观看"变为"已观看"
        if (currentLectureStatus === true) {
          skipCount++;
          skipList.push({ userId: studentUserId, name: existing.name, reason: '已是已观看状态（保留手动标记）' });
          continue;
        }
        
        // 只有当前是"未观看"，才更新
        if (isWatched) {
          const newProgress = {
            ...existing.lecture_progress,
            [subject]: {
              ...currentSubjectProgress,
              [String(lecture)]: true,
            },
          };

          // 更新学科字段（如果学员还没有该学科）
          let newSubject = existing.subject;
          if (!existing.subject.includes(subject)) {
            newSubject = existing.subject ? `${existing.subject},${subject}` : subject;
          }

          const { error } = await client
            .from('students')
            .update({
              subject: newSubject,
              lecture_progress: newProgress,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (error) {
            console.error(`[导入观看数据] 更新失败:`, error);
            failedList.push({ userId: studentUserId, name: existing.name, reason: error.message });
          } else {
            updateCount++;
            updateList.push(`${existing.name}`);
          }
        } else {
          skipCount++;
          skipList.push({ userId: studentUserId, name: existing.name, reason: '观看时长不足' });
        }
      } else {
        // ===== 学员不存在，自动创建 =====
        if (autoCreate && isWatched) {
          // 只有观看时长达标的才创建学员
          const newStudent = {
            user_id: studentUserId,
            name: studentName || `用户${studentUserId.slice(-6)}`,
            subject: subject,
            status: '跟进中',
            lecture_progress: {
              [subject]: {
                [String(lecture)]: true,
              },
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: created, error: createError } = await client
            .from('students')
            .insert(newStudent)
            .select()
            .single();

          if (createError) {
            console.error(`[导入观看数据] 创建学员失败:`, createError);
            failedList.push({ userId: studentUserId, name: studentName, reason: createError.message });
          } else {
            createCount++;
            createList.push(created.name);
            // 加入映射，避免重复创建
            existingMap.set(studentUserId, {
              id: created.id,
              name: created.name,
              subject: subject,
              lecture_progress: newStudent.lecture_progress as Record<string, Record<string, boolean>>,
            });
          }
        } else if (!autoCreate) {
          // 不自动创建，记录未找到
          failedList.push({ userId: studentUserId, name: studentName, reason: '学员不存在' });
        } else {
          // 观看时长不足，不创建
          skipCount++;
          skipList.push({ userId: studentUserId, name: studentName, reason: '观看时长不足，未创建学员' });
        }
      }
    }

    // 构建结果消息
    const messages: string[] = [];
    if (createCount > 0) messages.push(`新建 ${createCount} 名学员`);
    if (updateCount > 0) messages.push(`更新 ${updateCount} 名学员观看记录`);
    if (skipCount > 0) messages.push(`跳过 ${skipCount} 条`);
    if (failedList.length > 0) messages.push(`失败 ${failedList.length} 条`);

    console.log('[导入观看数据] 导入完成:', { createCount, updateCount, skipCount, failedCount: failedList.length });

    return NextResponse.json({
      success: true,
      created: createCount,
      updated: updateCount,
      skipped: skipCount,
      failed: failedList.length,
      message: messages.join('，') || '没有数据需要处理',
      details: {
        createList: createList.slice(0, 10),
        updateList: updateList.slice(0, 10),
        skipList: skipList.slice(0, 5),
        failedList: failedList.slice(0, 5),
        lecture,
        subject,
        watchedThreshold,
      },
    });
  } catch (error) {
    console.error('Import lecture error:', error);
    return NextResponse.json(
      { error: '导入观看数据失败: ' + String(error) },
      { status: 500 }
    );
  }
}
