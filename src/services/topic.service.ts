import UserRepository from "../repositories/user.repository.js";
import RoleRepository from "../repositories/role.repository.js";
import ProfileRepository from "../repositories/profile.repository.js";
import curriculumService from "./curriculum.service.js";
class TopicService {
    async createTopics(userId: number) {

        const user = await UserRepository.findById(userId);
        const { school_id: schoolId, role_id: roleId } = user as NonNullable<typeof user>;
        const role = await RoleRepository.findById(roleId);
        const { role_name } = role as NonNullable<typeof role>;
        let profile;
        let classNames: string[] = [];
        let sectionNames: string[] = [];

        if (role_name == "STUDENT") {
            profile = await ProfileRepository.findStudentByUserId(userId);
            if (profile) {
                const studentMap = await ProfileRepository.findStudentClassSection((profile as any).student_id);
                if (studentMap) {
                    const [classesRaw, sectionsRaw] = await Promise.all([
                        curriculumService.allClass(),
                        curriculumService.section(),
                    ]);
                    const allClasses  = classesRaw?.data  ?? classesRaw  ?? [];
                    const allSections = sectionsRaw?.data ?? sectionsRaw ?? [];
                    const classObj   = allClasses.find((c: any)  => Number(c.id ?? c.class_id)   === Number((studentMap as any).class_id));
                    const sectionObj = allSections.find((s: any) => Number(s.id ?? s.section_id) === Number((studentMap as any).section_id));
                    if (classObj)   classNames.push(classObj.class_name);
                    if (sectionObj) sectionNames.push(sectionObj.section_name);
                }
            }
        }
        else if (role_name == "TEACHER") {
            profile = await ProfileRepository.findTeacherByUserId(userId);
            if (profile) {
                const teacherMaps = await ProfileRepository.findTeacherClassSections((profile as any).teacher_id);
                if (teacherMaps) {
                    const [classesRaw, sectionsRaw] = await Promise.all([
                        curriculumService.allClass(),
                        curriculumService.section(),
                    ]);
                    const allClasses  = classesRaw?.data  ?? classesRaw  ?? [];
                    const allSections = sectionsRaw?.data ?? sectionsRaw ?? [];
                    for (const map of teacherMaps) {
                        const classObj   = allClasses.find((c: any)  => Number(c.id ?? c.class_id)   === Number((map as any).class_id));
                        const sectionObj = allSections.find((s: any) => Number(s.id ?? s.section_id) === Number((map as any).section_id));
                        if (classObj   && !classNames.includes(classObj.class_name))     classNames.push(classObj.class_name);
                        if (sectionObj && !sectionNames.includes(sectionObj.section_name)) sectionNames.push(sectionObj.section_name);
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