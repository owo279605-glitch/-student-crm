import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 自动识别列名映射
function autoDetectColumnMapping(columns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // 列名映射规则（Excel列名 -> 数据库字段）
  const columnRules: Array<{ patterns: string[]; field: string }> = [
    { patterns: ['用户id', '用户ID', 'userid', 'userId', 'user_id', '学员id', '学员ID'], field: 'user_id' },
    { patterns: ['姓名', '名字', 'name', '学生姓名', '学员姓名'], field: 'name' },
    { patterns: ['电话', '手机', 'phone', '手机号', '电话号码', '联系电话'], field: 'phone' },
    { patterns: ['微信', 'wechat', '微信号'], field: 'wechat' },
    { patterns: ['来源', 'source', '客户来源', '线索来源'], field: 'source' },
    { patterns: ['课程', 'course', '报名课程', '课程名称'], field: 'course' },
    { patterns: ['学科', 'subject', '科目', '报名学科'], field: 'subject' },
    { patterns: ['承接人', 'undertaker', '负责人', '销售', '跟进人'], field: 'undertaker' },
    { patterns: ['金额', 'amount', '报名金额', '学费', '费用'], field: 'amount' },
    { patterns: ['备注', 'notes', 'note', '说明', '备注信息'], field: 'notes' },
    { patterns: ['状态', 'status', '学员状态', '跟进状态'], field: 'status' },
    // 讲座观看进度
    { patterns: ['第1讲', 'lecture1', '第一讲'], field: 'lecture_1' },
    { patterns: ['第2讲', 'lecture2', '第二讲'], field: 'lecture_2' },
    { patterns: ['第3讲', 'lecture3', '第三讲'], field: 'lecture_3' },
    { patterns: ['第4讲', 'lecture4', '第四讲'], field: 'lecture_4' },
    { patterns: ['第5讲', 'lecture5', '第五讲'], field: 'lecture_5' },
    { patterns: ['第6讲', 'lecture6', '第六讲'], field: 'lecture_6' },
    { patterns: ['第7讲', 'lecture7', '第七讲'], field: 'lecture_7' },
    { patterns: ['第8讲', 'lecture8', '第八讲'], field: 'lecture_8' },
    { patterns: ['第9讲', 'lecture9', '第九讲'], field: 'lecture_9' },
    { patterns: ['第10讲', 'lecture10', '第十讲'], field: 'lecture_10' },
    { patterns: ['第11讲', 'lecture11', '第十一讲'], field: 'lecture_11' },
    { patterns: ['第12讲', 'lecture12', '第十二讲'], field: 'lecture_12' },
    { patterns: ['第13讲', 'lecture13', '第十三讲'], field: 'lecture_13' },
    { patterns: ['第14讲', 'lecture14', '第十四讲'], field: 'lecture_14' },
    { patterns: ['第15讲', 'lecture15', '第十五讲'], field: 'lecture_15' },
  ];
  
  for (const col of columns) {
    const colLower = col.toLowerCase().trim();
    let matched = false;
    
    for (const rule of columnRules) {
      for (const pattern of rule.patterns) {
        if (colLower === pattern.toLowerCase() || colLower.includes(pattern.toLowerCase())) {
          mapping[col] = rule.field;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
  }
  
  return mapping;
}

// 批量导入学员 - 以用户ID为唯一标识，直接更新数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { students, userId, userRole } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: '没有可导入的数据' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 获取所有用户（用于承接人匹配）
    const { data: allUsers } = await client
      .from('users')
      .select('id, name');
    
    const userNameSet = new Set<string>();
    allUsers?.forEach((u) => {
      if (u.name) userNameSet.add(u.name.trim());
    });

    // 自动识别列映射
    const columns = Object.keys(students[0] || {});
    const columnMapping = autoDetectColumnMapping(columns);
    
    console.log('[导入调试] 自动识别的列映射:', columnMapping);

    // 检查是否识别到用户ID列
    const userIdColumn = Object.entries(columnMapping).find(([_, field]) => field === 'user_id')?.[0];
    if (!userIdColumn) {
      return NextResponse.json(
        { error: '未能识别"用户ID"列，请确保Excel中包含"用户ID"或类似列名' },
        { status: 400 }
      );
    }

    // 获取所有要导入的user_id
    const allUserIds = students
      .map((row: Record<string, unknown>) => {
        const value = row[userIdColumn];
        return value ? String(value).trim() : '';
      })
      .filter((id: string) => id);

    if (allUserIds.length === 0) {
      return NextResponse.json(
        { error: '没有有效的用户ID数据' },
        { status: 400 }
      );
    }

    // 查询已存在的学员（基于user_id）
    const { data: existingStudents } = await client
      .from('students')
      .select('*')
      .in('user_id', allUserIds);

    // 定义学员类型
    type StudentRecord = {
      id: string;
      name: string;
      user_id: string | null;
      phone: string | null;
      wechat: string | null;
      source: string | null;
      course: string | null;
      subject: string | null;
      undertaker: string | null;
      amount: number | null;
      notes: string | null;
      lecture_progress: Record<string, boolean> | null;
      [key: string]: unknown;
    };

    // 建立user_id到学员数据的映射
    const existingMap = new Map<string, StudentRecord>();
    existingStudents?.forEach((s) => {
      if (s.user_id) {
        existingMap.set(s.user_id, s as StudentRecord);
      }
    });

    const newStudents: Record<string, unknown>[] = [];
    const updateStudents: { id: string; data: Record<string, unknown> }[] = [];
    const processedUserIds = new Set<string>();
    
    // 详细结果记录
    const successList: string[] = [];
    const updateList: string[] = [];
    const failList: { name: string; reason: string }[] = [];
    const undertakerWarnings: { name: string; undertaker: string; unknownNames: string[] }[] = [];

    let newCount = 0;
    let updateCount = 0;

    for (const row of students) {
      // 根据自动识别的列映射转换数据
      const mappedRow: Record<string, unknown> = {};
      const lectureProgress: Record<string, boolean> = {};
      
      for (const [excelColumn, dbField] of Object.entries(columnMapping)) {
        const value = row[excelColumn];
        if (value === undefined || value === null || value === '') continue;
        
        // 处理讲座观看进度字段
        if (dbField.startsWith('lecture_')) {
          const lectureNum = dbField.replace('lecture_', '');
          const watchedValues = ['是', '已看', '观看', '1', 'true', 'yes', '完成', '√', '✓'];
          const isWatched = watchedValues.includes(String(value).trim().toLowerCase());
          lectureProgress[lectureNum] = isWatched;
        }
        // 处理金额字段
        else if (dbField === 'amount') {
          const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value);
          if (!isNaN(numValue)) {
            mappedRow[dbField] = Math.round(numValue);
          }
        }
        // 处理状态字段
        else if (dbField === 'status') {
          const statusMap: Record<string, string> = {
            '待跟进': 'pending',
            '已报名': 'enrolled',
            '已退费': 'refunded',
            '已流失': 'lost',
            'pending': 'pending',
            'enrolled': 'enrolled',
            'refunded': 'refunded',
            'lost': 'lost',
          };
          mappedRow[dbField] = statusMap[String(value).trim()] || 'pending';
        }
        else {
          mappedRow[dbField] = String(value).trim();
        }
      }

      // 如果有观看进度数据，合并到 mappedRow
      if (Object.keys(lectureProgress).length > 0) {
        mappedRow.lecture_progress = lectureProgress;
      }

      const studentUserId = (mappedRow.user_id as string)?.trim();
      const studentName = (mappedRow.name as string)?.trim() || studentUserId;
      
      // 检查user_id是否有效
      if (!studentUserId) {
        failList.push({ name: studentName || '(未知)', reason: '用户ID为空' });
        continue;
      }

      // 检查本次导入中是否已处理过该user_id
      if (processedUserIds.has(studentUserId)) {
        continue;
      }
      processedUserIds.add(studentUserId);

      // 检查承接人是否有效
      const undertakerValue = mappedRow.undertaker as string;
      if (undertakerValue) {
        const undertakerNames = undertakerValue.split(/[,，]/).map((n) => n.trim()).filter((n) => n);
        const unknownNames = undertakerNames.filter((n) => !userNameSet.has(n));
        
        if (unknownNames.length > 0) {
          undertakerWarnings.push({
            name: studentName,
            undertaker: undertakerValue,
            unknownNames,
          });
        }
      }

      // 检查数据库中是否已存在（以user_id为唯一标识）
      const existing = existingMap.get(studentUserId);

      if (!existing) {
        // 新学员 - 直接插入
        mappedRow.status = mappedRow.status || 'pending';
        mappedRow.is_refunded = mappedRow.is_refunded || false;
        
        // 如果没有姓名，使用用户ID作为姓名
        if (!mappedRow.name) {
          mappedRow.name = studentUserId;
        }

        newStudents.push(mappedRow);
        newCount++;
        successList.push(`${mappedRow.name as string}(${studentUserId})`);
      } else {
        // 已存在的学员 - 更新数据
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        // 可更新的字段列表
        const fieldsToUpdate = ['name', 'phone', 'wechat', 'source', 'course', 'subject', 'undertaker', 'amount', 'notes', 'status'];
        
        for (const field of fieldsToUpdate) {
          if (mappedRow[field] !== undefined && mappedRow[field] !== null && mappedRow[field] !== '') {
            updateData[field] = mappedRow[field];
          }
        }

        // 处理观看进度 - 合并而不是覆盖
        if (mappedRow.lecture_progress) {
          const existingProgress = (existing.lecture_progress as Record<string, boolean>) || {};
          const newProgress = mappedRow.lecture_progress as Record<string, boolean>;
          
          // 合并观看进度：新数据覆盖旧数据
          updateData.lecture_progress = { ...existingProgress, ...newProgress };
        }

        updateStudents.push({ id: existing.id, data: updateData });
        updateCount++;
        updateList.push(`${studentName}(${studentUserId})`);
      }
    }

    // 批量插入新学员
    if (newStudents.length > 0) {
      const { error: insertError } = await client
        .from('students')
        .insert(newStudents);

      if (insertError) {
        console.error('Batch insert error:', insertError);
        return NextResponse.json(
          { 
            error: '批量导入失败: ' + insertError.message,
            failList: newStudents.map((s) => ({ 
              name: s.name as string, 
              reason: insertError.message 
            })),
          },
          { status: 500 }
        );
      }
    }

    // 批量更新已存在的学员
    if (updateStudents.length > 0) {
      for (const { id, data } of updateStudents) {
        const { error: updateError } = await client
          .from('students')
          .update(data)
          .eq('id', id);

        if (updateError) {
          console.error('Update error for student', id, updateError);
        }
      }
    }

    // 构建结果消息
    const messages: string[] = [];
    if (newCount > 0) messages.push(`新增 ${newCount} 条`);
    if (updateCount > 0) messages.push(`更新 ${updateCount} 条`);
    if (failList.length > 0) messages.push(`失败 ${failList.length} 条`);

    return NextResponse.json({
      success: true,
      imported: newCount,
      updated: updateCount,
      failed: failList.length,
      message: messages.join('，') || '没有数据需要处理',
      details: {
        successList,
        updateList,
        failList,
        undertakerWarnings,
        columnMapping, // 返回自动识别的列映射，方便前端展示
      },
    });
  } catch (error) {
    console.error('Import students error:', error);
    return NextResponse.json(
      { error: '批量导入失败: ' + String(error) },
      { status: 500 }
    );
  }
}
