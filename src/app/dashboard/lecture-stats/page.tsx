'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, RefreshCw, Users, TrendingUp } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

// 按学科分开的统计数据
interface SubjectStat {
  total: number;
  avgRate: number;
  watchRates: Record<number, number>;
  activeLectures: number[];
}

interface LectureStats {
  teacherStats: Array<{
    teacher: string;
    subject: string | null;
    total: number;
    avgRate: number;
    watchRates: Record<number, number>;
  }>;
  overallStats: {
    totalStudents: number;
    subjects: Record<string, SubjectStat>;
    activeLectures: number[];
  };
  lectures: number[];
}

const SUBJECT_COLORS: Record<string, string> = {
  '语文': 'text-red-600',
  '数学': 'text-blue-600',
  '英语': 'text-green-600',
};

const SUBJECT_BG_COLORS: Record<string, string> = {
  '语文': 'bg-red-50 border-red-200',
  '数学': 'bg-blue-50 border-blue-200',
  '英语': 'bg-green-50 border-green-200',
};

export default function LectureStatsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LectureStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 检查登录状态
  useEffect(() => {
    const userStr = localStorage.getItem('crm_user');
    if (!userStr) {
      router.push('/');
      return;
    }

    try {
      const userData = JSON.parse(userStr) as User;
      setUser(userData);
    } catch {
      router.push('/');
    }
  }, [router]);

  // 获取统计数据
  const fetchStats = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        userId: user.id,
        userRole: user.role,
      });

      const res = await fetch(`/api/students/lecture-stats?${params}`);
      const data = await res.json();

      if (res.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 当用户信息加载完成后获取统计数据
  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // 获取学科列表
  const subjects = stats?.overallStats.subjects ? Object.keys(stats.overallStats.subjects) : ['语文', '数学', '英语'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">观看数据看板</h1>
        </div>
        <Button variant="outline" onClick={fetchStats} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          刷新数据
        </Button>
      </div>

      {stats ? (
        <>
          {/* 整体统计 - 按学科分开 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">整体观看情况（按学科统计）</CardTitle>
              <p className="text-sm text-muted-foreground">
                每个学科独立统计，学员可能属于多个学科
              </p>
            </CardHeader>
            <CardContent>
              {/* 总学员数 */}
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">总学员数：</span>
                <span className="text-2xl font-bold">{stats.overallStats.totalStudents}</span>
              </div>

              {/* 按学科分组显示 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {subjects.map((subject) => {
                  const subjectStat = stats.overallStats.subjects[subject];
                  if (!subjectStat) return null;
                  
                  const hasData = subjectStat.activeLectures.length > 0;
                  
                  return (
                    <div 
                      key={subject} 
                      className={`p-4 rounded-lg border ${SUBJECT_BG_COLORS[subject] || 'bg-muted/50'}`}
                    >
                      {/* 学科标题 */}
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-lg font-bold ${SUBJECT_COLORS[subject] || ''}`}>
                          {subject}
                        </h3>
                        <Badge variant="outline">{subjectStat.total} 人</Badge>
                      </div>
                      
                      {/* 平均观看率 */}
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">平均观看率</span>
                        <span className={`text-xl font-bold ${
                          subjectStat.avgRate >= 80 ? 'text-green-600' :
                          subjectStat.avgRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {subjectStat.avgRate}%
                        </span>
                        {hasData && (
                          <span className="text-xs text-muted-foreground">
                            (第{subjectStat.activeLectures.join('、')}讲)
                          </span>
                        )}
                      </div>
                      
                      {/* 各讲座观看率 */}
                      <div className="grid grid-cols-5 gap-1">
                        {stats.lectures.map((l) => {
                          const rate = subjectStat.watchRates[l] || 0;
                          const isActive = subjectStat.activeLectures.includes(l);
                          return (
                            <div 
                              key={l} 
                              className={`text-center p-1 rounded ${isActive ? 'bg-white/50' : 'bg-white/20 opacity-50'}`}
                              title={`第${l}讲：${rate}%`}
                            >
                              <div className="text-xs text-muted-foreground">{l}</div>
                              <div className={`text-xs font-bold ${
                                rate >= 80 ? 'text-green-600' :
                                rate >= 50 ? 'text-yellow-600' : 
                                rate > 0 ? 'text-red-600' : 'text-muted-foreground'
                              }`}>
                                {rate}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 按销售统计 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">按销售统计</CardTitle>
              <p className="text-sm text-muted-foreground">
                观看数据仅统计该销售负责学科的学员，如销售未分配学科则显示0%
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">承接人</TableHead>
                      <TableHead className="text-center w-20">负责学科</TableHead>
                      <TableHead className="text-center w-20">学员数</TableHead>
                      <TableHead className="text-center w-20">平均观看率</TableHead>
                      {stats.lectures.map((l) => (
                        <TableHead key={l} className="text-center w-16">第{l}讲</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.teacherStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4 + stats.lectures.length} className="text-center text-muted-foreground">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.teacherStats.map((teacher) => (
                        <TableRow key={teacher.teacher}>
                          <TableCell className="font-medium">{teacher.teacher}</TableCell>
                          <TableCell className="text-center">
                            {teacher.subject ? (
                              <Badge variant="outline">{teacher.subject}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">未分配</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{teacher.total}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${
                              teacher.avgRate >= 80 ? 'text-green-600' :
                              teacher.avgRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {teacher.avgRate}%
                            </span>
                          </TableCell>
                          {stats.lectures.map((l) => {
                            const rate = teacher.watchRates[l] || 0;
                            return (
                              <TableCell key={l} className="text-center">
                                <span className={`font-medium ${
                                  rate >= 80 ? 'text-green-600' :
                                  rate >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {rate}%
                                </span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无数据
          </CardContent>
        </Card>
      )}
    </div>
  );
}
