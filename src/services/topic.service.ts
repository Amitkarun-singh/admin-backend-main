import UserRepository from "../repositories/user.repository.ts";
import RoleRepository from "../repositories/role.repository.ts";
import ProfileRepository from "../repositories/profile.repository.ts";
import ClassRepository from "../repositories/class.repository.ts";
class TopicService {
    async createTopics(userId: number) {

        const { school_id: schoolId, role_id: roleId } = await UserRepository.findById(userId);
        const { role_name } = await RoleRepository.findById(roleId);
        let profile;
        let classNames: string[] = [];
        let sectionNames: string[] = [];

        if (role_name == "STUDENT") {
            profile = await ProfileRepository.findStudentByUserId(userId);
            if (profile) {
                const studentMap = await ProfileRepository.findStudentClassSection((profile as any).student_id);
                if (studentMap) {
                    const classObj = await ClassRepository.findById((studentMap as any).class_id);
                    const sectionObj = await ClassRepository.findSectionById((studentMap as any).section_id);
                    if (classObj) classNames.push((classObj as any).class_name);
                    if (sectionObj) sectionNames.push((sectionObj as any).section_name);
                }
            }
        }
        else if (role_name == "TEACHER") {
            profile = await ProfileRepository.findTeacherByUserId(userId);
            if (profile) {
                const teacherMaps = await ProfileRepository.findTeacherClassSections((profile as any).teacher_id);
                if (teacherMaps) {
                    for (const map of teacherMaps) {
                        const classObj = await ClassRepository.findById((map as any).class_id);
                        const sectionObj = await ClassRepository.findSectionById((map as any).section_id);
                        if (classObj && !classNames.includes((classObj as any).class_name)) classNames.push((classObj as any).class_name);
                        if (sectionObj && !sectionNames.includes((sectionObj as any).section_name)) sectionNames.push((sectionObj as any).section_name);
                    }
                }
            }
        } else if (role_name == "ADMIN") {
            //profile = await ProfileRepository.findAdminByUserId(userId);
        }
        const topics = new Set<string>();
        if (role_name == "STUDENT") {
            topics.add(`global`);
            topics.add(`user_${userId}`);
            topics.add(`school_${schoolId}`);
            topics.add(`school_${schoolId}_role_${role_name.toLowerCase()}`);
            if (classNames.length > 0) topics.add(`school_${schoolId}_class_${classNames[0].split(" ")[1]}`);
            if (sectionNames.length > 0) topics.add(`school_${schoolId}_class_${classNames[0].split(" ")[1]}_section_${sectionNames[0]}`);
        } else if (role_name == "TEACHER") {
            topics.add(`global`);
            topics.add(`user_${userId}`);
            topics.add(`school_${schoolId}`);
            topics.add(`school_${schoolId}_role_${role_name.toLowerCase()}`);
            for (const className of classNames) {
                topics.add(`school_${schoolId}_class_${className.split(" ")[1]}`);
            }
            for (const sectionName of sectionNames) {
                topics.add(`school_${schoolId}_class_${classNames[0].split(" ")[1]}_section_${sectionName}`);
            }
        } else if (role_name == "ADMIN") {

        }
        return Array.from(topics);
    }


}

export default new TopicService();