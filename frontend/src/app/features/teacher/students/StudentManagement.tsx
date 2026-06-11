import { useState, useEffect, useMemo } from "react";
import { getAuthToken } from "../../../../utils/authStorage";
import { useTranslation } from "react-i18next";
import { usePageTitle, PAGE_TITLES } from "../../../../hooks/usePageTitle";
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
  Users,
  UserPlus,
  Download,
  Upload,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserX,
  Calendar,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import { useToast } from "../../../../hooks/useToast";
import { useDebounce } from "../../../../hooks/useDebounce";
import { usePageHeader } from "../../../../contexts/TeacherHeaderContext";
import { ToastContainer } from "../../../../components/ui";
import { useNavigate } from "react-router";
import { EditStudentModal } from "./EditStudentModal";
import { getApiUrl, getAssetUrl } from "../../../../utils/apiConfig";

type TabType = "list" | "deleted";

// Student Stats Interface
interface StudentStats {
  label: string;
  value: number;
  change: number;
  trend: "up" | "down";
  icon: any;
  color: string;
}

export function StudentManagement() {
  usePageTitle(PAGE_TITLES.TEACHER_STUDENTS);
  const { t } = useTranslation();
  usePageHeader({
    breadcrumb: [t("breadcrumb.dashboard"), t("breadcrumb.students")],
  });
  const navigate = useNavigate();
  const { toasts, removeToast, success, error, warning } = useToast();
  const toast = { success, error, warning };
  const [activeTab, setActiveTab] = useState<TabType>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // Debounce 500ms
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isButtonClosing, setIsButtonClosing] = useState(false);
  const [deletedStudents, setDeletedStudents] = useState<any[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportCooldown, setExportCooldown] = useState(0);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [perPage] = useState(10);
  const [studentStats, setStudentStats] = useState<StudentStats[]>([
    { label: t('teacher.students.management.stats.label.totalStudents'), value: 0, change: 0, trend: "up", icon: Users, color: "#EA580C" },
    { label: t('teacher.students.management.stats.label.activeStudents'), value: 0, change: 0, trend: "up", icon: UserCheck, color: "#F97316" },
    { label: t('teacher.students.management.stats.label.inactiveStudents'), value: 0, change: 0, trend: "down", icon: UserX, color: "#FB923C" },
    { label: t('teacher.students.management.stats.label.newThisMonth'), value: 0, change: 0, trend: "up", icon: Calendar, color: "#FDBA74" },
  ]);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter students by course (frontend only, since backend doesn't have course field)
  const filteredStudents = useMemo(() => {
    if (courseFilter === "all") {
      return students;
    }
    return students.filter((student) => student.course === courseFilter);
  }, [students, courseFilter]);

  // Get unique courses (Khóa tháng) for filter dropdown
  const uniqueCourses = useMemo(() => {
    const courses = students.map(s => s.course);
    return Array.from(new Set(courses)).sort((a, b) => {
      // Extract month number from "Khóa tháng X" format
      const monthA = parseInt(a.replace('Khóa tháng ', ''));
      const monthB = parseInt(b.replace('Khóa tháng ', ''));
      return monthB - monthA; // Sort descending (newest first)
    });
  }, [students]);

  // Fetch students from API
  useEffect(() => {
    fetchStudents();
    fetchStudentStats();
    if (activeTab === 'deleted') {
      fetchDeletedStudents();
    }
  }, [activeTab, currentPage, debouncedSearchQuery, courseFilter, statusFilter]);

  const fetchStudentStats = async () => {
    try {
      const token = getAuthToken();
      
      if (!token) {
        return;
      }

      const response = await fetch(getApiUrl('teacher/dashboard/student-stats'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.data) {
          const data = result.data;
          
          setStudentStats([
            { 
              label: t('teacher.students.management.stats.label.totalStudents'), 
              value: data.total_students, 
              change: data.total_change, 
              trend: data.total_change >= 0 ? "up" : "down", 
              icon: Users, 
              color: "#EA580C" 
            },
            { 
              label: t('teacher.students.management.stats.label.activeStudents'), 
              value: data.active_students, 
              change: data.active_change, 
              trend: data.active_change >= 0 ? "up" : "down", 
              icon: UserCheck, 
              color: "#F97316" 
            },
            { 
              label: t('teacher.students.management.stats.label.inactiveStudents'), 
              value: data.inactive_students, 
              change: data.inactive_change, 
              trend: data.inactive_change >= 0 ? "up" : "down", 
              icon: UserX, 
              color: "#FB923C" 
            },
            { 
              label: t('teacher.students.management.stats.label.newThisMonth'), 
              value: data.new_students_this_month, 
              change: data.new_students_change, 
              trend: data.new_students_change >= 0 ? "up" : "down", 
              icon: Calendar, 
              color: "#FDBA74" 
            },
          ]);
        }
      } else {
        console.error('Failed to fetch student stats');
      }
    } catch (error) {
      console.error('Error fetching student stats:', error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      
      if (!token) {
        toast.error(t('teacher.students.management.toast.loginRequired'));
        setLoading(false);
        return;
      }

      // Build query params for backend filtering and pagination
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
      });

      // Add search query (use debounced value)
      if (debouncedSearchQuery) {
        params.append('search', debouncedSearchQuery);
      }

      // Add status filter
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      // Note: courseFilter is frontend-only since backend doesn't have course field
      // We'll filter courses after getting data

      const response = await fetch(getApiUrl(`teacher/students?${params.toString()}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.data) {
          // Handle paginated response
          const paginationData = result.data;
          const studentsData = paginationData.data || [];
          
          // Transform API data to match our format
          const transformedStudents = studentsData.map((student: any) => {
            // Calculate course month from creation date
            const createdDate = new Date(student.uCreated_at);
            const courseMonth = `Khóa tháng ${createdDate.getMonth() + 1}`;
            
            return {
              id: student.uId,
              name: student.uName || 'N/A',
              phone: student.uPhone || 'N/A',
              email: student.uEmail || 'Chưa có',
              ageGroup: student.age_group || 'teens',
              course: courseMonth,
              status: student.uStatus || 'active',
              avatar: student.uName?.split(' ').slice(-2).map((n: string) => n[0]).join('').toUpperCase() || 'NA',
              avatarUrl: student.avatar_url || null,
              createdAt: new Date(student.uCreated_at).toLocaleDateString('vi-VN'),
              uDoB: student.uDoB || null,
              dateOfBirth: student.uDoB ? student.uDoB.split(' ')[0] : null,
            };
          });
          
          setStudents(transformedStudents);
          setTotalPages(paginationData.last_page || 1);
          setTotalStudents(paginationData.total || 0);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch students:', errorData);
        
        if (response.status === 401) {
          toast.error(t('teacher.students.management.toast.sessionExpired'));
        } else {
          toast.error(errorData.message || t('teacher.students.management.toast.loadError'));
        }
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error(t('teacher.students.management.toast.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedStudents = async () => {
    setLoadingDeleted(true);
    try {
      const token = getAuthToken();
      
      if (!token) {
        toast.error(t('teacher.students.management.toast.loginRequired'));
        setLoadingDeleted(false);
        return;
      }

      const response = await fetch(getApiUrl('teacher/students/deleted'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          setDeletedStudents(result.data);
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || t('teacher.students.management.toast.deletedLoadError'));
      }
    } catch (error) {
      console.error('Error fetching deleted students:', error);
      toast.error(t('teacher.students.management.toast.deletedLoadGeneralError'));
    } finally {
      setLoadingDeleted(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  const handleRestoreStudent = async (studentId: number, studentName: string) => {
    const result = await Swal.fire({
      title: t('teacher.students.management.confirmRestore.title'),
      html: `
        <div style="text-align: left; font-size: 14px;">
          <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 12px 14px; border-radius: 10px; border-left: 3px solid #10b981;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${t('teacher.students.management.confirmRestore.willBeRestored')}</p>
            <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              <span style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
              ${studentName}
            </p>
          </div>
        </div>
      `,
      icon: 'question',
      iconColor: '#10b981',
      showCancelButton: true,
      confirmButtonText: t('teacher.students.management.confirmRestore.restore'),
      cancelButtonText: t('teacher.students.management.confirmDelete.cancel'),
      width: '420px',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'swal-custom-success',
        cancelButton: 'swal-custom-cancel',
      },
      buttonsStyling: false,
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      try {
        const token = getAuthToken();
        
        if (!token) {
          toast.error(t('teacher.students.management.toast.loginRequired'));
          return;
        }

        const response = await fetch(getApiUrl(`teacher/student/${studentId}/restore`), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          toast.success(t('teacher.students.management.toast.restoreSuccess', { name: studentName }));

          // Log activity (best-effort)
          import("../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
            logTeacherActivity({
              action: "student.restore",
              entity_type: "student",
              entity_id: studentId,
              detail: `Khôi phục học viên: ${studentName}`,
            });
          });

          fetchDeletedStudents();
          fetchStudents();
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || t('teacher.students.management.toast.restoreError'));
        }
      } catch (error) {
        console.error('Error restoring student:', error);
        toast.error(t('teacher.students.management.toast.restoreGeneralError'));
      }
    }
  };

  const handlePermanentDelete = async (studentId: number, studentName: string) => {
    const result = await Swal.fire({
      title: t('teacher.students.management.confirmPermanentDelete.title'),
      html: `
        <div style="text-align: left; font-size: 14px;">
          <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 12px 14px; border-radius: 10px; border-left: 3px solid #ef4444;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${t('teacher.students.management.confirmPermanentDelete.cannotRestore')}</p>
            <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 700;">
              ${studentName}
            </p>
          </div>
          <p style="margin-top: 12px; color: #6b7280; font-size: 13px;">${t('teacher.students.management.confirmPermanentDelete.cannotUndo')}</p>
        </div>
      `,
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonText: t('teacher.students.management.confirmPermanentDelete.permanentDelete'),
      cancelButtonText: t('teacher.students.management.confirmDelete.cancel'),
      width: '420px',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'swal-custom-confirm',
        cancelButton: 'swal-custom-cancel',
      },
      buttonsStyling: false,
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      try {
        const token = getAuthToken();
        
        if (!token) {
          toast.error(t('teacher.students.management.toast.loginRequired'));
          return;
        }

        const response = await fetch(getApiUrl(`teacher/student/${studentId}/permanent`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          toast.success(t('teacher.students.management.toast.permanentDeleteSuccess', { name: studentName }));
          fetchDeletedStudents();
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || t('teacher.students.management.toast.permanentDeleteError'));
        }
      } catch (error) {
        console.error('Error permanent deleting student:', error);
        toast.error(t('teacher.students.management.toast.permanentDeleteGeneralError'));
      }
    }
  };

  const handleSelectStudent = (studentId: number) => {
    const isCurrentlySelected = selectedStudents.includes(studentId);
    
    // If deselecting and this is the last one, trigger closing animation
    if (isCurrentlySelected && selectedStudents.length === 1) {
      setIsButtonClosing(true);
      setTimeout(() => {
        setSelectedStudents([]);
        setIsButtonClosing(false);
      }, 400); // Match animation duration
    } else {
      setSelectedStudents(prev => 
        isCurrentlySelected 
          ? prev.filter(id => id !== studentId)
          : [...prev, studentId]
      );
    }
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      // Deselect all with animation
      setIsButtonClosing(true);
      setTimeout(() => {
        setSelectedStudents([]);
        setIsButtonClosing(false);
      }, 400);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const handleEditClick = (student: typeof students[0]) => {
    setEditingStudent(student);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (updatedStudent: any) => {
    // Refresh the student list
    await fetchStudents();
    toast.success(t('teacher.students.management.toast.updateSuccess', { name: updatedStudent.name }));
  };

  const handleDeleteClick = async (student: typeof students[0]) => {
    const result = await Swal.fire({
      title: t('teacher.students.management.confirmDelete.title'),
      html: `
        <div style="text-align: left; font-size: 14px;">
          <div style="background: linear-gradient(135deg, #fee2e2 0%, #fed7aa 100%); padding: 12px 14px; border-radius: 10px; border-left: 3px solid #ef4444;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${t('teacher.students.management.confirmDelete.willBeDeleted')}</p>
            <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              <span style="width: 6px; height: 6px; background: #ef4444; border-radius: 50%; display: inline-block;"></span>
              ${student.name}
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonText: `<span style="display: flex; align-items: center; gap: 6px; font-size: 14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> ${t('teacher.students.management.confirmDelete.deleteNow')}</span>`,
      cancelButtonText: t('teacher.students.management.confirmDelete.cancel'),
      width: '420px',
      customClass: {
        popup: 'swal-custom-popup',
        title: 'swal-custom-title',
        htmlContainer: 'swal-custom-html',
        confirmButton: 'swal-custom-confirm',
        cancelButton: 'swal-custom-cancel',
        actions: 'swal-custom-actions',
      },
      buttonsStyling: false,
      reverseButtons: true,
      focusCancel: true,
      showClass: {
        popup: 'swal2-show',
        backdrop: 'swal2-backdrop-show',
        icon: 'swal2-icon-show'
      },
      hideClass: {
        popup: 'swal2-hide',
        backdrop: 'swal2-backdrop-hide',
        icon: 'swal2-icon-hide'
      }
    });

    if (result.isConfirmed) {
      try {
        const token = getAuthToken();
        
        if (!token) {
          toast.error(t('teacher.students.management.toast.loginRequired'));
          return;
        }

        const response = await fetch(getApiUrl(`teacher/student/${student.id}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          setStudents(students.filter(s => s.id !== student.id));

          // Log activity (best-effort)
          import("../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
            logTeacherActivity({
              action: "student.delete",
              entity_type: "student",
              entity_id: student.id,
              detail: `Xoá học viên: ${student.name}`,
            });
          });

          toast.success(t('teacher.students.management.toast.deleteSuccess', { name: student.name }));
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || t('teacher.students.management.toast.deleteError'));
        }
      } catch (error) {
        console.error('Error deleting student:', error);
        toast.error(t('teacher.students.management.toast.deleteError'));
      }
    }
  };

  const handleBulkDelete = async () => {
    const selectedCount = selectedStudents.length;
    const selectedNames = students
      .filter(s => selectedStudents.includes(s.id))
      .map(s => s.name)
      .slice(0, 3);
    
    const namesDisplay = selectedCount <= 3 
      ? selectedNames.join(', ')
      : `${selectedNames.join(', ')} ${t('teacher.students.management.confirmBulkDelete.and', { count: selectedCount - 3 })}`;

    const result = await Swal.fire({
      title: t('teacher.students.management.confirmBulkDelete.title'),
      html: `
        <div style="text-align: left; font-size: 14px;">
          <div style="background: linear-gradient(135deg, #fee2e2 0%, #fed7aa 100%); padding: 12px 14px; border-radius: 10px; border-left: 3px solid #ef4444;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${t('teacher.students.management.confirmBulkDelete.willDelete', { count: selectedCount })}</p>
            <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              <span style="width: 6px; height: 6px; background: #ef4444; border-radius: 50%; display: inline-block;"></span>
              ${namesDisplay}
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonText: `<span style="display: flex; align-items: center; gap: 6px; font-size: 14px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> ${t('teacher.students.management.confirmBulkDelete.deleteAll')}</span>`,
      cancelButtonText: t('teacher.students.management.confirmDelete.cancel'),
      width: '420px',
      customClass: {
        popup: 'swal-custom-popup',
        title: 'swal-custom-title',
        htmlContainer: 'swal-custom-html',
        confirmButton: 'swal-custom-confirm',
        cancelButton: 'swal-custom-cancel',
        actions: 'swal-custom-actions',
      },
      buttonsStyling: false,
      reverseButtons: true,
      focusCancel: true,
      showClass: {
        popup: 'swal2-show',
        backdrop: 'swal2-backdrop-show',
        icon: 'swal2-icon-show'
      },
      hideClass: {
        popup: 'swal2-hide',
        backdrop: 'swal2-backdrop-hide',
        icon: 'swal2-icon-hide'
      }
    });

    if (result.isConfirmed) {
      try {
        const token = getAuthToken();
        
        if (!token) {
          toast.error(t('teacher.students.management.toast.loginRequired'));
          return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const studentId of selectedStudents) {
          try {
            const response = await fetch(getApiUrl(`teacher/student/${studentId}`), {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            failCount++;
          }
        }

        setStudents(students.filter(s => !selectedStudents.includes(s.id)));
        setSelectedStudents([]);

        if (failCount === 0) {
          toast.success(t('teacher.students.management.toast.bulkDeleteSuccess', { count: successCount }));
        } else {
          toast.warning(t('teacher.students.management.toast.bulkDeletePartial', { success: successCount, fail: failCount }));
        }

        // Log bulk delete (best-effort)
        if (successCount > 0) {
          import("../../../../services/teacherActivityLog").then(({ logTeacherActivity }) => {
            logTeacherActivity({
              action: "student.delete",
              entity_type: "student",
              detail: `Xoá ${successCount} học viên cùng lúc`,
              meta: { bulk: true, success: successCount, failed: failCount },
            });
          });
        }
      } catch (error) {
        console.error('Error bulk deleting students:', error);
        toast.error(t('teacher.students.management.toast.deleteError'));
      }
    }
  };

  const handleExportExcel = (e?: React.MouseEvent) => {
    // Prevent double execution and event bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Check if already exporting or in cooldown
    if (isExporting || exportCooldown > 0) {
      toast.warning(t('teacher.students.management.toast.exportWait', { seconds: exportCooldown }));
      return;
    }
    
    if (loading) return;

    setIsExporting(true);
    
    try {
      // Prepare data for Excel
      const excelData = students.map((student, index) => ({
        'STT': index + 1,
        'Họ và tên': student.name,
        'Số điện thoại': student.phone,
        'Email': student.email === 'Chưa có' ? '' : student.email,
        'Nhóm tuổi': student.ageGroup === 'kids' ? 'Trẻ em' : student.ageGroup === 'teens' ? 'Thiếu niên' : 'Người lớn',
        'Khóa': student.course,
        'Trạng thái': student.status === 'active' ? 'Đang học' : 'Tạm nghỉ',
        'Ngày tạo': student.createdAt,
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 5 },  // STT
        { wch: 25 }, // Họ và tên
        { wch: 15 }, // SĐT
        { wch: 30 }, // Email
        { wch: 15 }, // Nhóm tuổi
        { wch: 15 }, // Khóa
        { wch: 12 }, // Trạng thái
        { wch: 12 }, // Ngày tạo
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học viên');

      // Generate filename with current date
      const date = new Date();
      const filename = `Danh_sach_hoc_vien_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}_${String(date.getDate()).padStart(2, '0')}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success(t('teacher.students.management.toast.exportSuccess', { count: students.length }));
      
      // Set cooldown for 10 seconds
      setExportCooldown(10);
      const interval = setInterval(() => {
        setExportCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error(t('teacher.students.management.toast.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: "list" as TabType, icon: Users },
    { id: "deleted" as TabType, icon: Trash2 },
  ];

  const getStatusBadge = (status: string) => {
    const config = {
      active: { label: t('teacher.students.management.status.active'), color: "#10B981", bg: "#D1FAE5" },
      inactive: { label: t('teacher.students.management.status.inactive'), color: "#6B7280", bg: "#F3F4F6" },
    };
    const { label, color, bg } = config[status as keyof typeof config] || config.active;
    return (
      <span
        className="px-2 py-1 rounded-full text-xs font-medium"
        style={{ color, backgroundColor: bg }}
      >
        {label}
      </span>
    );
  };

  const getAgeGroupBadge = (ageGroup: string) => {
    const config = {
      kids: { label: t('teacher.students.management.ageGroup.kids'), icon: "👶" },
      teens: { label: t('teacher.students.management.ageGroup.teens'), icon: "🎓" },
      adults: { label: t('teacher.students.management.ageGroup.adults'), icon: "👔" },
    };
    const { label, icon } = config[ageGroup as keyof typeof config] || config.teens;
    return (
      <span className="px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 bg-slate-100 text-slate-600">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="px-6 py-5">
      {/* Header - inline title + tabs */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-bold text-slate-900 leading-tight">
            {t('teacher.students.management.title')}
          </h1>
          <p className="text-slate-500 text-[11px] mt-0.5">
            {t('teacher.students.management.breadcrumb')}
          </p>
        </div>
        <div className="flex gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-medium text-[12px] rounded-md transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`teacher.students.management.tabs.${tab.id}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "list" && (
        <div>
          {/* Stats Cards — compact, neutral */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {studentStats.map((stat, index) => {
              const Icon = stat.icon;
              const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
              return (
                <div
                  key={index}
                  className="bg-white rounded-lg px-3.5 py-3 border border-slate-200 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-[18px] h-[18px] text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-lg font-bold text-slate-900 leading-none">
                        {stat.value.toLocaleString()}
                      </p>
                      {stat.change !== 0 && (
                        <span
                          className="flex items-center gap-0.5 text-[10px] font-medium"
                          style={{ color: stat.trend === "up" ? "#16A34A" : "#DC2626" }}
                        >
                          <TrendIcon className="w-2.5 h-2.5" />
                          {Math.abs(stat.change)}%
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search & Filter Bar with Action Buttons */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 mb-4">
            <div className="flex items-center gap-2">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('teacher.students.management.search.placeholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to page 1 when searching
                  }}
                  className="w-full pl-9 pr-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                />
              </div>
              <select 
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setCurrentPage(1); // Reset to page 1 when filtering
                }}
                className="px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
              >
                <option value="all">{t('teacher.students.management.search.allCourses')}</option>
                {uniqueCourses.map((course) => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
              <select 
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1); // Reset to page 1 when filtering
                }}
                className="px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
              >
                <option value="all">{t('teacher.students.management.search.allStatuses')}</option>
                <option value="active">{t('teacher.students.management.status.active')}</option>
                <option value="inactive">{t('teacher.students.management.status.inactive')}</option>
              </select>
              <button 
                onClick={() => {
                  // Reset filters
                  setSearchQuery("");
                  setCourseFilter("all");
                  setStatusFilter("all");
                  setCurrentPage(1); // Reset to page 1
                  toast.success(t('teacher.students.management.toast.filtersCleared'));
                }}
                className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                {t('teacher.students.management.search.clearFilters')}
              </button>
              
              {/* Action Buttons - moved here */}
              <div className="flex items-center gap-3 ml-auto">
                {(selectedStudents.length > 0 || isButtonClosing) && (
                  <button
                    key={`bulk-delete-${selectedStudents.length}`}
                    onClick={handleBulkDelete}
                    className={`flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium shadow-lg hover:shadow-xl ${
                      isButtonClosing ? 'animate-mosaic-disappear' : 'animate-mosaic-appear'
                    }`}
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>{t('teacher.students.management.actions.deleteSelected')}</span>
                    <span 
                      key={`count-${selectedStudents.length}`}
                      className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-700 rounded-full text-sm font-bold animate-count-pulse"
                    >
                      {selectedStudents.length}
                    </span>
                    <span>{t('teacher.students.management.actions.students')}</span>
                  </button>
                )}
                <button
                  onClick={() => navigate('/giao-vien/students/them-moi')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                >
                  <UserPlus className="w-5 h-5" />
                  {t('teacher.students.management.actions.addStudent')}
                </button>
                <button 
                  onClick={handleExportExcel}
                  disabled={isExporting || exportCooldown > 0}
                  className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E5E7EB] text-[#374151] rounded-lg hover:bg-[#F9FAFB] transition-colors font-medium ${
                    (isExporting || exportCooldown > 0) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>{t('teacher.students.management.actions.exporting')}</span>
                    </>
                  ) : exportCooldown > 0 ? (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>{t('teacher.students.management.actions.waitSeconds', { seconds: exportCooldown })}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>{t('teacher.students.management.actions.exportExcel')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Student Table */}
          {loading ? (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              <p className="mt-4 text-[#6B7280]">{t('teacher.students.management.loading')}</p>
            </div>
          ) : (
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input 
                        type="checkbox" 
                        className="rounded cursor-pointer" 
                        checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      {t('teacher.students.management.table.student')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      {t('teacher.students.management.table.phone')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      {t('teacher.students.management.table.email')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      {t('teacher.students.management.table.ageGroup')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      {t('teacher.students.management.table.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      {t('teacher.students.management.table.createdAt')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      {t('teacher.students.management.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <Search className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
                        <p className="text-[#6B7280] font-medium">{t('teacher.students.management.noResults.title')}</p>
                        <p className="text-sm text-[#9CA3AF] mt-1">{t('teacher.students.management.noResults.subtitle')}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                    <tr key={student.id} onClick={() => handleEditClick(student)} className="hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded cursor-pointer" 
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => handleSelectStudent(student.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {student.avatarUrl ? (
                            <img 
                              src={getAssetUrl(student.avatarUrl)}
                              alt={student.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-[#E5E7EB]"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-sm">
                              {student.avatar}
                            </div>
                          )}
                          <span className="font-medium text-[#111827]">
                            {student.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6B7280]">
                        {student.phone}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6B7280]">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6B7280]">
                        {getAgeGroupBadge(student.ageGroup)}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(student.status)}</td>
                      <td className="px-6 py-4 text-sm text-[#6B7280]">
                        {student.createdAt}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditClick(student); }}
                            className="p-2 hover:bg-[#EFF6FF] rounded-lg transition-colors"
                            title={t('teacher.students.management.actions.edit')}
                          >
                            <Edit className="w-4 h-4 text-[#6B7280]" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(student); }}
                            className="p-2 hover:bg-[#FEE2E2] rounded-lg transition-colors"
                            title={t('teacher.students.management.actions.delete')}
                          >
                            <Trash2 className="w-4 h-4 text-[#EF4444]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-between">
              <p className="text-sm text-[#6B7280]">
                {t('teacher.students.management.pagination.showing')} <span className="font-medium text-[#111827]">{((currentPage - 1) * perPage) + 1}-{Math.min(currentPage * perPage, totalStudents)}</span> {t('teacher.students.management.pagination.of')}{" "}
                <span className="font-medium text-[#111827]">{totalStudents}</span> {t('teacher.students.management.pagination.results')}
              </p>
              {/* Only show pagination if there are more than 10 students */}
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button 
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm font-medium ${
                      currentPage === 1 
                        ? 'text-[#D1D5DB] cursor-not-allowed' 
                        : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    {t('teacher.students.management.pagination.previous')}
                  </button>
                  
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-1.5 text-[#6B7280]">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page as number)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          currentPage === page
                            ? 'bg-orange-600 text-white'
                            : 'border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                  
                  <button 
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm font-medium ${
                      currentPage === totalPages 
                        ? 'text-[#D1D5DB] cursor-not-allowed' 
                        : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    {t('teacher.students.management.pagination.next')}
                  </button>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {activeTab === "deleted" && (
        <div>
          {loadingDeleted ? (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              <p className="mt-4 text-[#6B7280]">{t('teacher.students.management.deleted.loading')}</p>
            </div>
          ) : deletedStudents.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
              <Trash2 className="w-16 h-16 text-[#9CA3AF] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#111827] mb-2">{t('teacher.students.management.deleted.empty.title')}</h3>
              <p className="text-[#6B7280]">{t('teacher.students.management.deleted.empty.subtitle')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="p-4 bg-[#FEF3C7] border-b border-[#FDE68A]">
                <div className="flex items-center gap-2 text-[#92400E]">
                  <AlertTriangle className="w-5 h-5" />
                  <p className="text-sm font-medium">
                    {t('teacher.students.management.deleted.warning')}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        {t('teacher.students.management.table.student')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        {t('teacher.students.management.table.phone')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        {t('teacher.students.management.deleted.table.deletedTime')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        {t('teacher.students.management.deleted.table.remaining')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        {t('teacher.students.management.table.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {deletedStudents.map((student) => (
                      <tr key={student.uId} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {student.avatar_url ? (
                              <img 
                                src={getAssetUrl(student.avatar_url)}
                                alt={student.uName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-[#E5E7EB] opacity-60"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#9CA3AF] text-white flex items-center justify-center font-semibold text-sm">
                                {student.uName?.split(' ').slice(-2).map((n: string) => n[0]).join('').toUpperCase() || 'NA'}
                              </div>
                            )}
                            <span className="font-medium text-[#6B7280]">
                              {student.uName || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">
                          {student.uPhone || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">
                          {student.deleted_hours_ago < 1 
                            ? t('teacher.students.management.deleted.table.justNow')
                            : t('teacher.students.management.deleted.table.hoursAgo', { hours: Math.floor(student.deleted_hours_ago) })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            student.hours_remaining > 12 
                              ? 'bg-green-100 text-green-800'
                              : student.hours_remaining > 6
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {student.hours_remaining > 0 
                              ? `${Math.floor(student.hours_remaining)}h ${Math.floor((student.hours_remaining % 1) * 60)}m`
                              : t('teacher.students.management.deleted.table.expired')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {student.can_restore && (
                              <button 
                                onClick={() => handleRestoreStudent(student.uId, student.uName)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-1"
                                title={t('teacher.students.management.deleted.actions.restore')}
                              >
                                <Check className="w-4 h-4" />
                                {t('teacher.students.management.deleted.actions.restore')}
                              </button>
                            )}
                            <button 
                              onClick={() => handlePermanentDelete(student.uId, student.uName)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-1"
                              title={t('teacher.students.management.deleted.actions.permanentDelete')}
                            >
                              <X className="w-4 h-4" />
                              {t('teacher.students.management.deleted.actions.permanentDelete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingStudent(null);
        }}
        student={editingStudent}
        onSave={handleSaveEdit}
        toast={toast}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}