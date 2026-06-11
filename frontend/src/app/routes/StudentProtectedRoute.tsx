import React from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthToken, getAuthUser, clearAuthData } from '../../utils/authStorage';

interface StudentProtectedRouteProps {
  ageGroup: 'kids' | 'teens' | 'adults';
  children: React.ReactNode;
}

export const StudentProtectedRoute: React.FC<StudentProtectedRouteProps> = ({ 
  ageGroup, 
  children 
}) => {
  const token = getAuthToken();
  const user = getAuthUser();

  // Not logged in
  if (!token || !user) {
    return <Navigate to="/dang-nhap" replace />;
  }
  
  try {
    
    // Not a student
    if ((user.role as string) !== 'student') {
      return <Navigate to="/" replace />;
    }
    
    // Class system đã bỏ — không chặn theo class_id nữa.
    // Mọi học viên login xong vào thẳng dashboard theo age_group.

    // Wrong age group - redirect to correct dashboard
    // teens no longer has /hoc-vien/teens prefix; redirect to /hoc-vien directly
    const userAgeGroup = (user.age_group as string) || 'teens';
    if (userAgeGroup !== ageGroup) {
      const target = userAgeGroup === 'teens' ? '/hoc-vien' : `/hoc-vien/${userAgeGroup}`;
      return <Navigate to={target} replace />;
    }
    
    // All checks passed
    return <>{children}</>;
    
  } catch (error) {
    // Invalid user data
    clearAuthData();
    return <Navigate to="/dang-nhap" replace />;
  }
};
