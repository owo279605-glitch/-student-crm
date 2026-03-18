'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/custom-pagination';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  MoreHorizontal,
  Eye,
  Download,
  Video,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Student {
  id: string;
  name: string;
  phone: string | null;
  wechat: string | null;
  source: string | null;
  course: string | null;
  subject: string | null;
  undertaker: string | null;
  user_id: string | null;
  status: string;
  is_refunded: boolean;
  refund_reason: string | null;
  sales_id: string | null;
  amount: number | null;
  notes: string | null;
  lecture_progress: Record<string, Record<string, boolean>> | null; // 按学科存储 { "语文": { "1": true }, "数学": { "2": false } }
  created_at: string;
  updated_at: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  subject?: string;
}

interface Stats {
  total: number;
  subjectStats: { subject: string; count: number }[];
  salesSubjectStats: { subject: string; count: number }[];
  statusStats: { status: string; count: number }[];
  currentUserName?: string;
  currentUserSubject?: string; // 当前用户负责学科
}

interface ApiResponse {
  data: Student[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  salesUsers?: { id: string; name: string }[];
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '待跟进', variant: 'secondary' },
  enrolled: { label: '已报名', variant: 'default' },
  refunded: { label: '已退费', variant: 'destructive' },
  lost: { label: '已流失', variant: 'outline' },
};

export default function StudentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [salesUsers, setSalesUsers] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, subjectStats: [], salesSubjectStats: [], statusStats: [] });

  // 筛选条件
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRefunded, setFilterRefunded] = useState('all');
  const [filterUndertaker, setFilterUndertaker] = useState('all');
  const [filterEmptyUserId, setFilterEmptyUserId] = useState(false); // 筛选空白用户ID
  
  // 观看进度筛选
  const [filterLectures, setFilterLectures] = useState<number[]>([]);
  const [filterWatched, setFilterWatched] = useState<'all' | 'true' | 'false'>('all');

  // 弹窗状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeSubjectTab, setActiveSubjectTab] = useState<string>('语文'); // 当前选中的学科选项卡
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // 备注编辑状态
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    wechat: '',
    source: '',
    course: '',
    subject: '',
    undertaker: '',
    userId: '',
    status: 'pending',
    isRefunded: false,
    refundReason: '',
    salesId: '',
    amount: '',
    notes: '',
  });

  // 导入相关
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<Record<string, unknown>[]>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // 观看数据导入相关
  const [lectureImportOpen, setLectureImportOpen] = useState(false);
  const [lectureFile, setLectureFile] = useState<File | null>(null);
  const [lectureData, setLectureData] = useState<{ userId: string; name: string; watchDuration: number }[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<number>(1);
  const [selectedSubject, setSelectedSubject] = useState<string>('语文');
  const [lectureImporting, setLectureImporting] = useState(false);

  useEffect(() => {
    // 从localStorage获取用户信息
    const userStr = localStorage.getItem('crm_user');
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      console.log('Loaded user from localStorage:', parsedUser);
      
      // 如果没有 role 字段，需要重新登录
      if (!parsedUser.role) {
        console.error('User role is missing, redirecting to login');
        localStorage.removeItem('crm_user');
        window.location.href = '/';
        return;
      }
      
      setUser(parsedUser);
      
      // 从服务器获取最新的用户信息（包括 subject）
      fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: parsedUser.id }),
      })
        .then(res => res.json())
        .then(data => {
          console.log('Fetched latest user info:', data);
          if (data.user) {
            // 更新 localStorage 和 state
            const updatedUser = { ...parsedUser, ...data.user };
            localStorage.setItem('crm_user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            
            // 如果是销售，自动设置学科为用户负责的学科
            if (updatedUser.role === 'sales' && updatedUser.subject) {
              console.log('Setting subject to:', updatedUser.subject);
              setSelectedSubject(updatedUser.subject);
            }
          }
        })
        .catch(err => console.error('Failed to fetch user info:', err));
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const params = new URLSearchParams({
        userId: user.id,
        userRole: user.role,
      });
      
      const res = await fetch(`/api/students/stats?${params}`);
      const data = await res.json();
      
      console.log('Stats API response:', data);
      
      if (res.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  }, [user]);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    
    console.log('Fetching students with:', { userId: user.id, userRole: user.role });
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        userId: user.id,
        userRole: user.role || 'sales', // 默认使用 sales 角色
      });
      if (filterName) params.set('name', filterName);
      if (filterPhone) params.set('phone', filterPhone);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterRefunded !== 'all') params.set('isRefunded', filterRefunded);
      if (filterUndertaker !== 'all') params.set('undertaker', filterUndertaker);
      if (filterEmptyUserId) params.set('emptyUserId', 'true');
      
      // 观看进度筛选
      if (filterLectures.length > 0 && filterWatched !== 'all') {
        params.set('lectures', filterLectures.join(','));
        params.set('watched', filterWatched);
      }

      const res = await fetch(`/api/students?${params}`);
      const data: ApiResponse = await res.json();

      setStudents(data.data || []);
      setTotal(data.total);
      if (data.salesUsers) {
        setSalesUsers(data.salesUsers);
      }
    } catch {
      toast.error('获取学员列表失败');
    } finally {
      setLoading(false);
    }
  }, [user, page, pageSize, filterName, filterPhone, filterStatus, filterRefunded, filterUndertaker, filterEmptyUserId, filterLectures, filterWatched]);

  useEffect(() => {
    if (user) {
      fetchStudents();
      fetchStats();
    }
  }, [user, fetchStudents, fetchStats]);

  const handleSearch = () => {
    setPage(1);
    fetchStudents();
  };

  const handleReset = () => {
    setFilterName('');
    setFilterPhone('');
    setFilterLectures([]);
    setFilterWatched('all');
    setFilterStatus('all');
    setFilterRefunded('all');
    setFilterUndertaker('all');
    setFilterEmptyUserId(false);
    setPage(1);
  };

  const openAddDialog = () => {
    setSelectedStudent(null);
    setFormData({
      name: '',
      phone: '',
      wechat: '',
      source: '',
      course: '',
      subject: '',
      undertaker: '',
      userId: '',
      status: 'pending',
      isRefunded: false,
      refundReason: '',
      salesId: '',
      amount: '',
      notes: '',
    });
    setEditDialogOpen(true);
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      name: student.name,
      phone: student.phone || '',
      wechat: student.wechat || '',
      source: student.source || '',
      course: student.course || '',
      subject: student.subject || '',
      undertaker: student.undertaker || '',
      userId: student.user_id || '',
      status: student.status,
      isRefunded: student.is_refunded,
      refundReason: student.refund_reason || '',
      salesId: student.sales_id || '',
      amount: student.amount?.toString() || '',
      notes: student.notes || '',
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('请填写学员姓名');
      return;
    }

    try {
      const url = selectedStudent ? `/api/students/${selectedStudent.id}` : '/api/students';
      const method = selectedStudent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userRole: user?.role,
          name: formData.name,
          phone: formData.phone || null,
          wechat: formData.wechat || null,
          source: formData.source || null,
          course: formData.course || null,
          subject: formData.subject || null,
          undertaker: formData.undertaker || null,
          studentUserId: formData.userId || null,
          status: formData.status,
          isRefunded: formData.isRefunded,
          refundReason: formData.isRefunded ? formData.refundReason : null,
          salesId: formData.salesId || null,
          amount: formData.amount ? parseInt(formData.amount) : null,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '保存失败');
        return;
      }

      toast.success(selectedStudent ? '更新成功' : '新增成功');
      setEditDialogOpen(false);
      fetchStudents();
    } catch {
      toast.error('保存失败');
    }
  };

  const handleDelete = async () => {
    if (!selectedStudent) return;

    try {
      const res = await fetch(`/api/students/${selectedStudent.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, userRole: user?.role }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '删除失败');
        return;
      }

      toast.success('删除成功');
      setDeleteDialogOpen(false);
      setSelectedStudent(null);
      fetchStudents();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('请选择要删除的学员');
      return;
    }

    try {
      const res = await fetch('/api/students/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, userId: user?.id, userRole: user?.role }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '批量删除失败');
        return;
      }

      toast.success(`成功删除 ${data.deleted} 条记录`);
      setSelectedIds([]);
      fetchStudents();
    } catch {
      toast.error('批量删除失败');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(students.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  // 打开详情弹窗
  const openDetailDialog = (student: Student) => {
    setSelectedStudent(student);
    
    // 根据用户分配的学科设置默认选项卡
    // 如果是销售，默认显示其负责的学科；如果是管理员，默认显示学员的主学科
    if (user?.role === 'sales' && user.subject) {
      setActiveSubjectTab(user.subject);
    } else if (student.subject) {
      // 取学员的第一个学科
      const firstSubject = student.subject.split(/[,，]/)[0]?.trim() || '语文';
      setActiveSubjectTab(firstSubject);
    } else {
      setActiveSubjectTab('语文');
    }
    
    setDetailDialogOpen(true);
  };

  // 开始编辑备注
  const startEditingNotes = (student: Student) => {
    setEditingNotesId(student.id);
    setEditingNotesValue(student.notes || '');
  };

  // 保存备注
  const saveNotes = async (studentId: string) => {
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userRole: user?.role,
          notes: editingNotesValue || null,
        }),
      });

      if (!res.ok) {
        toast.error('保存备注失败');
        return;
      }

      // 更新本地数据
      setStudents(students.map(s => 
        s.id === studentId ? { ...s, notes: editingNotesValue } : s
      ));
      setEditingNotesId(null);
      toast.success('备注已保存');
    } catch {
      toast.error('保存备注失败');
    }
  };

  // 取消编辑备注
  const cancelEditingNotes = () => {
    setEditingNotesId(null);
    setEditingNotesValue('');
  };

  // 清理当前学员的错误观看数据
  const cleanupLectureProgress = async (studentId: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      const currentProgress = student.lecture_progress || {};
      
      // 只保留有效的学科数据（语文、数学、英语）
      const cleanedProgress: Record<string, Record<string, boolean>> = {};
      const validSubjects = ['语文', '数学', '英语'];
      
      for (const [key, value] of Object.entries(currentProgress)) {
        if (validSubjects.includes(key) && typeof value === 'object' && value !== null) {
          cleanedProgress[key] = value as Record<string, boolean>;
        }
      }

      console.log('[清理数据] 原始数据:', currentProgress);
      console.log('[清理数据] 清理后:', cleanedProgress);

      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userRole: user?.role,
          lecture_progress: cleanedProgress,
        }),
      });

      if (!res.ok) {
        toast.error('清理数据失败');
        return;
      }

      // 更新本地数据
      setStudents(students.map(s => 
        s.id === studentId ? { ...s, lecture_progress: cleanedProgress } : s
      ));
      
      // 更新详情弹窗中的数据
      if (selectedStudent?.id === studentId) {
        setSelectedStudent({ ...selectedStudent, lecture_progress: cleanedProgress });
      }
      
      toast.success('已清理错误数据');
    } catch (error) {
      console.error('清理数据失败:', error);
      toast.error('清理数据失败');
    }
  };

  // 更新观看进度（按学科存储）
  const updateLectureProgress = async (studentId: string, lecture: number, watched: boolean, subject?: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      // 获取学员的学科，如果没有指定则使用学员的主学科
      const targetSubject = subject || student.subject || '语文';
      
      // 按学科更新观看进度（使用字符串 key）
      const currentProgress = student.lecture_progress || {};
      const currentSubjectProgress = currentProgress[targetSubject] || {};
      
      const newProgress = {
        ...currentProgress,
        [targetSubject]: {
          ...currentSubjectProgress,
          [String(lecture)]: watched,  // 使用字符串 key
        },
      };

      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userRole: user?.role,
          lecture_progress: newProgress,
        }),
      });

      if (!res.ok) {
        toast.error('更新观看状态失败');
        return;
      }

      // 更新本地数据
      setStudents(students.map(s => 
        s.id === studentId ? { ...s, lecture_progress: newProgress } : s
      ));
      
      // 如果详情弹窗打开，也更新选中的学员
      if (selectedStudent?.id === studentId) {
        setSelectedStudent({ ...selectedStudent, lecture_progress: newProgress });
      }
      
      toast.success(watched ? `已标记${targetSubject}第${lecture}讲为已观看` : `已取消${targetSubject}第${lecture}讲观看`);
    } catch (error) {
      console.error('[updateLectureProgress] 错误:', error);
      toast.error('更新观看状态失败');
    }
  };

  // Excel导入处理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);

    // 动态导入xlsx库
    const XLSX = await import('xlsx');
    const reader = new FileReader();

    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

      setImportData(jsonData);

      if (jsonData.length > 0) {
        const cols = Object.keys(jsonData[0]);
        setImportColumns(cols);
        
        // 检查是否包含用户ID列
        const hasUserId = cols.some(col => {
          const lowerCol = col.toLowerCase();
          return lowerCol.includes('用户id') || lowerCol.includes('userid') || lowerCol === 'user_id';
        });
        
        if (!hasUserId) {
          toast.warning('未检测到"用户ID"列，导入可能失败');
        }
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (importData.length === 0) {
      toast.error('没有可导入的数据');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: importData,
          userId: user?.id,
          userRole: user?.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '导入失败');
        return;
      }

      // 显示详细的导入结果
      const messages: string[] = [];
      if (data.imported > 0) messages.push(`新增 ${data.imported} 条`);
      if (data.updated > 0) messages.push(`更新 ${data.updated} 条`);
      if (data.failed > 0) messages.push(`失败 ${data.failed} 条`);
      
      toast.success(messages.join('，') || '没有数据需要处理');

      // 显示自动识别的列映射
      if (data.details?.columnMapping) {
        const mappedCols = Object.entries(data.details.columnMapping as Record<string, string>)
          .filter(([_, field]) => field !== '__skip__')
          .map(([col, field]) => `${col}→${field}`)
          .join('、');
        toast.info(`自动识别列: ${mappedCols}`);
      }

      // 显示失败详情
      if (data.details?.failList?.length > 0) {
        const failNames = data.details.failList.map((f: { name: string; reason: string }) => 
          `${f.name}(${f.reason})`
        ).join('、');
        toast.error(`导入失败: ${failNames}`);
      }

      // 显示承接人警告
      if (data.details?.undertakerWarnings?.length > 0) {
        const warnings = data.details.undertakerWarnings.map((w: { name: string; undertaker: string; unknownNames: string[] }) => 
          `${w.name}的承接人"${w.undertaker}"中包含未知用户: ${w.unknownNames.join('、')}`
        ).join('；');
        toast.warning(`承接人警告: ${warnings}`);
      }
      
      setImportDialogOpen(false);
      setImportFile(null);
      setImportData([]);
      setImportColumns([]);
      fetchStudents();
      fetchStats(); // 刷新统计数据
    } catch {
      toast.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 处理观看数据文件上传
  const handleLectureFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLectureFile(file);

    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      
      // 尝试不同编码读取CSV
      let workbook;
      if (file.name.endsWith('.csv')) {
        // 尝试GBK编码
        try {
          const decoder = new TextDecoder('gbk');
          const text = decoder.decode(arrayBuffer);
          workbook = XLSX.read(text, { type: 'string' });
        } catch {
          // 如果GBK失败，尝试UTF-8
          workbook = XLSX.read(arrayBuffer, { type: 'array' });
        }
      } else {
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      // 提取用户ID和观看时长
      const lectureRecords: { userId: string; name: string; watchDuration: number }[] = [];
      
      for (const row of jsonData) {
        // 查找用户ID列
        let userId = '';
        let name = '';
        let watchDuration = 0;
        
        for (const [key, value] of Object.entries(row)) {
          const keyLower = key.toLowerCase();
          if (keyLower.includes('用户id') || keyLower === 'userid') {
            userId = String(value || '').trim();
          } else if (keyLower.includes('姓名')) {
            name = String(value || '').trim();
          } else if (
            (keyLower.includes('观看时长') || keyLower.includes('停留时长')) 
            && keyLower.includes('秒')
          ) {
            // 支持"累计观看时长(秒)"和"直播间停留时长(秒)"等多种列名
            watchDuration = parseInt(String(value || '0').replace(/[^\d]/g, '')) || 0;
          }
        }

        if (userId) {
          lectureRecords.push({ userId, name, watchDuration });
        }
      }

      setLectureData(lectureRecords);
      toast.success(`已解析 ${lectureRecords.length} 条观看记录`);
    } catch (error) {
      console.error('解析文件失败:', error);
      toast.error('解析文件失败，请检查文件格式');
    }
  };

  // 导入观看数据
  const handleLectureImport = async () => {
    if (lectureData.length === 0) {
      toast.error('没有可导入的数据');
      return;
    }

    setLectureImporting(true);
    try {
      const res = await fetch('/api/students/import-lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture: selectedLecture,
          subject: selectedSubject,
          students: lectureData,
          watchedThreshold: 600, // 600秒 = 10分钟
          userId: user?.id,
          userRole: user?.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '导入失败');
        setLectureImporting(false);
        return;
      }

      // 显示导入结果 - 成功/失败统计
      const successCount = (data.created || 0) + (data.updated || 0);
      const failCount = data.failed || 0;
      const totalCount = lectureData.length;

      // 主要提示：成功X个 失败X个
      toast.success(`导入完成：成功 ${successCount} 个，跳过 ${data.skipped || 0} 个，失败 ${failCount} 个，共 ${totalCount} 条记录`);

      // 详细提示
      if (data.created > 0) {
        toast.info(`✅ 新建 ${data.created} 名${selectedSubject}学员并标记第${selectedLecture}讲已观看`);
      }
      if (data.updated > 0) {
        toast.info(`✅ 更新 ${data.updated} 名${selectedSubject}学员的第${selectedLecture}讲观看记录`);
      }
      if (data.skipped > 0) {
        toast.warning(`⚠️ ${data.skipped} 条被跳过（观看时长不足或已是已观看状态）`);
      }
      if (data.failed > 0) {
        toast.warning(`⚠️ ${data.failed} 条导入失败`);
      }

      // 显示失败的详情（最多显示5个）
      if (data.details?.failedList?.length > 0 && data.details.failedList.length <= 5) {
        const names = data.details.failedList.map((u: { userId: string; name: string; reason: string }) => 
          `${u.name || u.userId}(${u.reason})`
        ).join('、');
        toast.info(`失败详情: ${names}`);
      } else if (data.details?.failedList?.length > 5) {
        toast.info(`有 ${data.details.failedList.length} 条导入失败`);
      }

      setLectureImportOpen(false);
      setLectureFile(null);
      setLectureData([]);
      setSelectedLecture(1);
      setSelectedSubject('语文');
      fetchStudents();
      fetchStats();
    } catch (error) {
      console.error('导入观看数据失败:', error);
      toast.error('导入失败，请重试');
    } finally {
      setLectureImporting(false);
    }
  };

  // 导出数据
  const handleExport = async () => {
    if (!user) return;

    try {
      toast.info('正在导出数据...');

      const params = new URLSearchParams({
        userId: user.id,
        userRole: user.role,
      });

      const res = await fetch(`/api/students/export?${params}`);

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || '导出失败');
        return;
      }

      // 获取文件名
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = '学员数据.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
        }
      }

      // 下载文件
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('导出成功');
    } catch {
      toast.error('导出失败');
    }
  };

  // 清理重复数据
  const handleCleanup = async () => {
    if (!user || user.role !== 'admin') {
      toast.error('只有管理员可以执行此操作');
      return;
    }

    setCleaning(true);
    try {
      const res = await fetch('/api/students/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userRole: user.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '清理失败');
        return;
      }

      // 强制刷新页面数据
      fetchStudents();
      fetchStats();
      
      // 显示结果
      toast.success(data.message || '清理完成，已刷新数据');
      
      // 如果清理了数据，提示用户
      if (data.deleted > 0) {
        toast.success(`已删除 ${data.deleted} 条重复数据`);
      }
    } catch {
      toast.error('清理失败');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">学员管理 <span className="text-xs text-gray-400">v3.2</span></h2>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <Button variant="outline" onClick={handleCleanup} disabled={cleaning}>
              {cleaning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              清理重复
            </Button>
          )}
          <Button variant="outline" onClick={() => { fetchStudents(); fetchStats(); }}>
            刷新数据
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出数据
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            批量导入
          </Button>
          <Button variant="outline" onClick={() => setLectureImportOpen(true)}>
            <Video className="h-4 w-4 mr-2" />
            导入观看数据
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            新增学员
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">
              {user?.role === 'admin' 
                ? '学员总数' 
                : stats.currentUserSubject 
                  ? `我承接的${stats.currentUserSubject}学员` 
                  : '我承接的学员'}
            </div>
          </CardContent>
        </Card>
        {user?.role === 'admin' ? (
          // 管理员看到全站学科统计
          stats.subjectStats.map((stat) => (
            <Card key={stat.subject}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stat.count}</div>
                <div className="text-sm text-muted-foreground">{stat.subject || '未设置学科'}</div>
              </CardContent>
            </Card>
          ))
        ) : !stats.currentUserSubject ? (
          // 销售没有分配学科，显示所有学科统计
          stats.salesSubjectStats.map((stat) => (
            <Card key={stat.subject}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stat.count}</div>
                <div className="text-sm text-muted-foreground">{stat.subject}</div>
              </CardContent>
            </Card>
          ))
        ) : null}
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                placeholder="搜索姓名"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>电话</Label>
              <Input
                placeholder="搜索电话"
                value={filterPhone}
                onChange={(e) => setFilterPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pending">待跟进</SelectItem>
                  <SelectItem value="enrolled">已报名</SelectItem>
                  <SelectItem value="refunded">已退费</SelectItem>
                  <SelectItem value="lost">已流失</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>是否退费</Label>
              <Select value={filterRefunded} onValueChange={setFilterRefunded}>
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="false">未退费</SelectItem>
                  <SelectItem value="true">已退费</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {user?.role === 'admin' && (
              <div className="space-y-2">
                <Label>承接人</Label>
                <Select value={filterUndertaker} onValueChange={setFilterUndertaker}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {salesUsers.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex items-center gap-2 h-10">
                <Checkbox
                  id="emptyUserId"
                  checked={filterEmptyUserId}
                  onCheckedChange={(checked) => setFilterEmptyUserId(checked as boolean)}
                />
                <label htmlFor="emptyUserId" className="text-sm cursor-pointer">
                  只显示空白用户ID
                </label>
              </div>
            </div>
          </div>
          
          {/* 观看进度筛选 */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap items-start gap-4">
              <div className="space-y-2">
                <Label>筛选讲座（可多选）</Label>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((lecture) => (
                    <button
                      key={lecture}
                      onClick={() => {
                        if (filterLectures.includes(lecture)) {
                          setFilterLectures(filterLectures.filter(l => l !== lecture));
                        } else {
                          setFilterLectures([...filterLectures, lecture]);
                        }
                      }}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        filterLectures.includes(lecture)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      第{lecture}讲
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>观看状态</Label>
                <Select value={filterWatched} onValueChange={(v) => setFilterWatched(v as 'all' | 'true' | 'false')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="true">已观看</SelectItem>
                    <SelectItem value="false">未观看</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 ml-auto">
                <Button onClick={handleSearch}>搜索</Button>
                <Button variant="outline" onClick={handleReset}>重置</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm">已选择 {selectedIds.length} 项</span>
          <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            批量删除
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
            取消选择
          </Button>
        </div>
      )}

      {/* 学员列表 */}
      <Card>
        <CardContent className="p-0">
          {!loading && (
            <div className="px-4 py-2 border-b text-sm text-muted-foreground bg-muted/30">
              当前显示 {students.length} 条（共 {total} 条学员数据）
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>暂无数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === students.length && students.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-16">序号</TableHead>
                    <TableHead>用户ID</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead>微信</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>课程</TableHead>
                    <TableHead>学科</TableHead>
                    <TableHead>承接人</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>是否退费</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="w-12">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, index) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(student.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(student.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(page - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell className={student.user_id ? "" : "text-muted-foreground text-xs"}>
                        {student.user_id || "未设置"}
                      </TableCell>
                      <TableCell className="font-medium cursor-pointer hover:text-primary" onDoubleClick={() => openDetailDialog(student)}>
                        {student.name}
                      </TableCell>
                      <TableCell>{student.phone || '-'}</TableCell>
                      <TableCell>{student.wechat || '-'}</TableCell>
                      <TableCell>{student.source || '-'}</TableCell>
                      <TableCell>{student.course || '-'}</TableCell>
                      <TableCell>{student.subject || '-'}</TableCell>
                      <TableCell>{student.undertaker || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusMap[student.status]?.variant || 'default'}>
                          {statusMap[student.status]?.label || student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.is_refunded ? (
                          <Badge variant="destructive">已退费</Badge>
                        ) : (
                          <Badge variant="outline">未退费</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.amount ? `¥${student.amount}` : '-'}
                      </TableCell>
                      <TableCell className="max-w-32">
                        {editingNotesId === student.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingNotesValue}
                              onChange={(e) => setEditingNotesValue(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveNotes(student.id);
                                } else if (e.key === 'Escape') {
                                  cancelEditingNotes();
                                }
                              }}
                            />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveNotes(student.id)}>
                              ✓
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEditingNotes}>
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="truncate cursor-pointer hover:bg-muted px-1 py-0.5 rounded" 
                            onClick={() => startEditingNotes(student)}
                            title="点击编辑备注"
                          >
                            {student.notes || <span className="text-muted-foreground italic text-xs">点击添加</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(student)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDetailDialog(student)}>
                              <Eye className="h-4 w-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            {user?.role === 'admin' && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex justify-center">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / pageSize)}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* 编辑弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent ? '编辑学员' : '新增学员'}</DialogTitle>
            <DialogDescription>
              {selectedStudent ? '修改学员信息' : '填写学员信息'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>姓名 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>电话</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>微信</Label>
              <Input
                value={formData.wechat}
                onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>来源</Label>
              <Input
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>课程</Label>
              <Input
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>学科</Label>
              <Select
                value={formData.subject}
                onValueChange={(v) => setFormData({ ...formData, subject: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择学科" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="语文">语文</SelectItem>
                  <SelectItem value="数学">数学</SelectItem>
                  <SelectItem value="英语">英语</SelectItem>
                  <SelectItem value="物理">物理</SelectItem>
                  <SelectItem value="化学">化学</SelectItem>
                  <SelectItem value="其他">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>承接人</Label>
              <Input
                value={formData.undertaker}
                onChange={(e) => setFormData({ ...formData, undertaker: e.target.value })}
                placeholder="多人用逗号分隔，如：王孟博,刘盼盼,李一鑫"
              />
            </div>
            <div className="space-y-2">
              <Label>用户ID</Label>
              <Input
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                placeholder="系统用户ID"
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待跟进</SelectItem>
                  <SelectItem value="enrolled">已报名</SelectItem>
                  <SelectItem value="refunded">已退费</SelectItem>
                  <SelectItem value="lost">已流失</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>金额</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <Checkbox
                id="isRefunded"
                checked={formData.isRefunded}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isRefunded: checked as boolean })
                }
              />
              <Label htmlFor="isRefunded">是否退费</Label>
            </div>
            {formData.isRefunded && (
              <div className="col-span-2 space-y-2">
                <Label>退费原因</Label>
                <Input
                  value={formData.refundReason}
                  onChange={(e) =>
                    setFormData({ ...formData, refundReason: e.target.value })
                  }
                />
              </div>
            )}
            {user?.role === 'admin' && (
              <div className="space-y-2">
                <Label>销售</Label>
                <Select
                  value={formData.salesId}
                  onValueChange={(v) => setFormData({ ...formData, salesId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择销售" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-2">
              <Label>备注</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除学员 &quot;{selectedStudent?.name}&quot; 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 学员详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>学员详情 - {selectedStudent?.name}</DialogTitle>
            <DialogDescription>
              双击学员姓名可打开此详情页
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">姓名</Label>
                  <p className="font-medium">{selectedStudent.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">电话</Label>
                  <p>{selectedStudent.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">微信</Label>
                  <p>{selectedStudent.wechat || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">来源</Label>
                  <p>{selectedStudent.source || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">课程</Label>
                  <p>{selectedStudent.course || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">学科</Label>
                  <p>{selectedStudent.subject || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">承接人</Label>
                  <p>{selectedStudent.undertaker || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">状态</Label>
                  <Badge variant={statusMap[selectedStudent.status]?.variant || 'default'}>
                    {statusMap[selectedStudent.status]?.label || selectedStudent.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">是否退费</Label>
                  {selectedStudent.is_refunded ? (
                    <Badge variant="destructive">已退费</Badge>
                  ) : (
                    <Badge variant="outline">未退费</Badge>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">金额</Label>
                  <p>{selectedStudent.amount ? `¥${selectedStudent.amount}` : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">创建时间</Label>
                  <p className="text-sm">{new Date(selectedStudent.created_at).toLocaleString()}</p>
                </div>
                {selectedStudent.is_refunded && selectedStudent.refund_reason && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">退费原因</Label>
                    <p>{selectedStudent.refund_reason}</p>
                  </div>
                )}
              </div>

              {/* 备注 */}
              <div>
                <Label className="text-muted-foreground">备注</Label>
                <p className="whitespace-pre-wrap">{selectedStudent.notes || '暂无备注'}</p>
              </div>

              {/* 观看进度 - 按学科分选项卡显示 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-muted-foreground">
                    观看进度（点击切换观看状态）
                  </Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => cleanupLectureProgress(selectedStudent.id)}
                  >
                    清理错误数据
                  </Button>
                </div>
                {/* 调试信息 - 临时显示 */}
                <div className="text-xs text-muted-foreground mb-2 p-2 bg-gray-100 rounded">
                  <details>
                    <summary className="cursor-pointer font-medium">调试：lecture_progress 原始数据</summary>
                    <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 border rounded">
                      {JSON.stringify(selectedStudent.lecture_progress, null, 2)}
                    </pre>
                  </details>
                </div>
                <Tabs value={activeSubjectTab} onValueChange={setActiveSubjectTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="语文">语文</TabsTrigger>
                    <TabsTrigger value="数学">数学</TabsTrigger>
                    <TabsTrigger value="英语">英语</TabsTrigger>
                  </TabsList>
                  
                  {['语文', '数学', '英语'].map((subject) => {
                    // 获取学科数据
                    const progress = selectedStudent.lecture_progress;
                    let subjectProgress: Record<string, unknown> = {};
                    
                    if (progress && progress[subject]) {
                      subjectProgress = progress[subject] as Record<string, unknown>;
                    }
                    
                    return (
                      <TabsContent key={subject} value={subject} className="mt-4">
                        <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
                          {Array.from({ length: 15 }, (_, i) => i + 1).map((lecture) => {
                            // 只检查当前学科的观看状态
                            const value = subjectProgress[String(lecture)] ?? subjectProgress[lecture];
                            const isWatched = value === true;
                            
                            return (
                              <button
                                key={lecture}
                                onClick={() => updateLectureProgress(selectedStudent.id, lecture, !isWatched, subject)}
                                className={`p-2 rounded border text-center transition-colors ${
                                  isWatched 
                                    ? 'bg-green-100 border-green-500 text-green-700' 
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                }`}
                              >
                                <div className="text-xs">第{lecture}讲</div>
                                <div className="text-xs mt-1">
                                  {isWatched ? '✓ 已看' : '○ 未看'}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {subject}观看进度：点击讲座可切换观看状态
                        </p>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            <Button onClick={() => {
              setDetailDialogOpen(false);
              if (selectedStudent) {
                openEditDialog(selectedStudent);
              }
            }}>
              编辑信息
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量导入弹窗 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量导入/更新学员</DialogTitle>
            <DialogDescription>
              上传Excel文件，系统将自动识别"用户ID"列，根据用户ID匹配已有学员并更新数据
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>选择文件</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
              <p className="text-sm text-muted-foreground">
                支持的列：用户ID、姓名、电话、微信、来源、课程、学科、承接人、金额、备注、状态、第1讲到第15讲
              </p>
            </div>

            {importColumns.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>检测到的列</Label>
                  <div className="flex flex-wrap gap-2">
                    {importColumns.map((col) => (
                      <Badge key={col} variant="secondary">{col}</Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>数据预览（前5条）</Label>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {importColumns.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {importColumns.map((col) => (
                              <TableCell key={col}>
                                {String(row[col] || '')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    共 {importData.length} 条数据待处理，将根据"用户ID"匹配已有学员并更新数据
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportFile(null);
                setImportData([]);
                setImportColumns([]);
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleImport}
              disabled={importData.length === 0 || importing}
            >
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              开始导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 观看数据导入弹窗 */}
      <Dialog open={lectureImportOpen} onOpenChange={setLectureImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>导入观看数据</DialogTitle>
            <DialogDescription>
              上传直播观看数据CSV文件，自动更新学员观看进度
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>选择讲座</Label>
                <Select
                  value={selectedLecture.toString()}
                  onValueChange={(v) => setSelectedLecture(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 15 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        第{i + 1}讲
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>选择学科</Label>
                {user?.role === 'sales' ? (
                  <>
                    <Select
                      value={selectedSubject}
                      onValueChange={setSelectedSubject}
                      disabled
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="语文">语文</SelectItem>
                        <SelectItem value="数学">数学</SelectItem>
                        <SelectItem value="英语">英语</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      您只能导入"<strong className="text-primary">{selectedSubject}</strong>"学科的观看数据
                    </p>
                    {user?.subject && user.subject !== selectedSubject && (
                      <p className="text-sm text-orange-600">
                        提示：您的负责学科已更新为"{user.subject}"，请刷新页面
                      </p>
                    )}
                  </>
                ) : (
                  <Select
                    value={selectedSubject}
                    onValueChange={setSelectedSubject}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="语文">语文</SelectItem>
                      <SelectItem value="数学">数学</SelectItem>
                      <SelectItem value="英语">英语</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* 学员数据检查提示 */}
            {stats.total === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="text-yellow-600 mr-3">⚠️</div>
                  <div>
                    <p className="font-medium text-yellow-800">系统暂无学员数据</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      请先导入学员数据后，再导入观看数据。观看数据需要通过"用户ID"与学员匹配。
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>选择CSV文件</Label>
              <Input 
                type="file" 
                accept=".csv" 
                onChange={handleLectureFileChange} 
              />
              <p className="text-sm text-muted-foreground">
                文件需包含"用户ID"和"累计观看时长(秒)"列，观看时长 ≥ 600秒 视为已观看
              </p>
            </div>

            {lectureData.length > 0 && (
              <div className="space-y-2">
                <Label>数据预览（前5条）</Label>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>用户ID</TableHead>
                        <TableHead>姓名</TableHead>
                        <TableHead>观看时长(秒)</TableHead>
                        <TableHead>观看状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lectureData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.userId}</TableCell>
                          <TableCell>{row.name || '-'}</TableCell>
                          <TableCell>{row.watchDuration}</TableCell>
                          <TableCell>
                            <Badge variant={row.watchDuration >= 600 ? 'default' : 'secondary'}>
                              {row.watchDuration >= 600 ? '已观看' : '未观看'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground">
                  共 {lectureData.length} 条观看记录待导入
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLectureImportOpen(false);
                setLectureFile(null);
                setLectureData([]);
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleLectureImport}
              disabled={lectureData.length === 0 || lectureImporting}
            >
              {lectureImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              开始导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
