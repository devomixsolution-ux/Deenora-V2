
/**
 * Global Type Definitions for Madrasah Management App
 */

export type Language = 'bn' | 'en';

export interface Madrasah {
  id: string;
  name: string;
  phone?: string;
  logo_url?: string;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  email?: string;
  login_code?: string;
  balance: number;
  sms_balance: number;
  reve_api_key?: string;
  reve_secret_key?: string;
  reve_caller_id?: string;
  reve_client_id?: string;
}

export interface Class {
  id: string;
  madrasah_id: string;
  class_name: string;
  sort_order?: number | null;
  created_at?: string;
}

export interface Student {
  id: string;
  madrasah_id: string;
  class_id: string;
  student_name: string;
  roll: number | null;
  guardian_name?: string;
  guardian_phone: string;
  guardian_phone_2?: string;
  photo_url?: string;
  created_at?: string;
  classes?: Class;
}

export interface Teacher {
  id: string;
  madrasah_id: string;
  name: string;
  phone: string;
  login_code: string;
  is_active: boolean;
  permissions: {
    can_manage_students: boolean;
    can_manage_classes: boolean;
    can_send_sms: boolean;
    can_send_free_sms: boolean;
  };
  created_at: string;
}

export interface RecentCall {
  id: string;
  madrasah_id: string;
  student_id: string;
  called_at: string;
  students?: Student;
}

export interface SMSTemplate {
  id: string;
  madrasah_id?: string;
  title: string;
  body: string;
  created_at?: string;
}

export interface Transaction {
  id: string;
  madrasah_id: string;
  amount: number;
  sms_count?: number; // Added to track SMS quantity
  transaction_id: string;
  sender_phone: string;
  description?: string;
  type: 'credit' | 'debit';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  madrasahs?: Madrasah;
}

export interface AdminSMSStock {
  id: string;
  remaining_sms: number;
  updated_at: string;
}

export type View = 'home' | 'classes' | 'account' | 'students' | 'student-details' | 'student-form' | 'class-form' | 'admin-panel' | 'transactions' | 'wallet-sms' | 'admin-dashboard' | 'admin-approvals' | 'data-management' | 'teachers';

export interface AppState {
  currentView: View;
  selectedClassId?: string;
  selectedStudent?: Student;
  isEditing?: boolean;
}
