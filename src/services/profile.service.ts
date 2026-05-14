

import userRepository from "../repositories/user.repository.js";
import schoolRepository from "../repositories/school.repository.js";
import profileRepository from "../repositories/profile.repository.js";
import classRepository from "../repositories/class.repository.js";



class ProfileService {

async  getUserProfile(user_id: number, role: string, school_id: number) {
  let profileData: any = null;

  if (["ADMIN", "SUBADMIN"].includes(role)) {
    return profileData = await this.getAdminProfile(user_id);
  } else if (role === "TEACHER") {
    return profileData = await this.getTeacherProfile(user_id);
  } else if (role === "STUDENT") {
    return profileData = await this.getStudentProfile(user_id);
  }
  
  
}

 async getStudentProfile(user_id: number){
     const student: any = await profileRepository.findStudentByUserId(user_id);
     const user: any = await userRepository.findWithRoleAndPermissions(user_id);
     const school = student?.school_id ? await schoolRepository.findById(student.school_id) : null;
    
     const classSection: any = student ? await profileRepository.findStudentClassSection(student.student_id) : null;
     const studentClass: any = classSection?.class_id ? await classRepository.findById(classSection.class_id) : null;
     const studentSection: any = classSection?.section_id ? await classRepository.findSectionById(classSection.section_id) : null;

     const profileData = {
       gender : student?.gender?.toLowerCase() || null,
       dob : student?.dob,
       full_name: user?.full_name,
       number: user?.phone_number,
       email: user?.email,
       language: student?.preferred_language,
       role: "STUDENT",
       school_name: (school as any)?.school_name,
       board_name: (school as any)?.board,
       class_id: classSection?.class_id,
       section_id: classSection?.section_id,
       class_name: studentClass?.class_name,
       section_name: studentSection?.section_name,
     };
    return profileData
 }

 async getTeacherProfile(user_id: number){
     const teacher: any = await profileRepository.findTeacherByUserId(user_id);
     const user: any = await userRepository.findWithRoleAndPermissions(user_id);
     const school = teacher?.school_id ? await schoolRepository.findById(teacher.school_id) : null;
    
     const teacherClasses: any[] = teacher ? await profileRepository.findTeacherClassSections(teacher.teacher_id) : [];
     const classSection = teacherClasses.length > 0 ? teacherClasses[0] : null;

     const teacherClass: any = classSection?.class_id ? await classRepository.findById(classSection.class_id) : null;
     const teacherSection: any = classSection?.section_id ? await classRepository.findSectionById(classSection.section_id) : null;
    
     const profileData = {
       gender: (teacher as any)?.gender?.toLowerCase() || null,
       dob: (teacher as any)?.dob || null,
       full_name: user?.full_name,
       number: user?.phone_number,
       email: user?.email,
       language: (teacher as any)?.preferred_language || null,
       role: "TEACHER",
       school_name: (school as any)?.school_name,
       board_name: (school as any)?.board,
     
      class_name: teacherClass?.class_name,
      section_name: teacherSection?.section_name,
    };
    return profileData
  }

  async getAdminProfile(user_id: number){
     const user: any = await userRepository.findWithRoleAndPermissions(user_id);
     
     const profileData = {
       role: "ADMIN",
       full_name: user?.full_name,
       number: user?.phone_number,
       email: user?.email,
     };
     return profileData
  }

  
}

export default new ProfileService();
