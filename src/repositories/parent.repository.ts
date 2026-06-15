import sequelize from "../config/db.js";
import User from "../models/user.model.js";
import AdminRole from "../models/admin_role.model.js";
import ParentProfile from "../models/parent_profile.model.js";
import ParentStudentMap from "../models/parent_student_map.model.js";
import StudentProfile from "../models/student_profile.model.js";
import StudentClassSection from "../models/student_class_section.model.js";

export class ParentRepository {

  async findRoleByName(role_name: string, transaction?: any): Promise<AdminRole | null> {
    return AdminRole.findOne({ where: { role_name }, transaction });
  }

  async createUser(data: Record<string, any>, transaction?: any): Promise<User> {
    return User.create(data, { transaction });
  }

  async createParentProfile(data: Record<string, any>, transaction?: any): Promise<ParentProfile> {
    return ParentProfile.create(data, { transaction });
  }

  async findAllParents(school_id: number | bigint): Promise<ParentProfile[]> {
    return ParentProfile.findAll({
      where: { school_id },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name", "phone_number", "email", "status", "avatar"],
        },
        {
          model: StudentProfile,
          as: "students",
          attributes: ["student_id", "preferred_language", "dob", "gender", "onboarding_date"],
          through: { attributes: [] } as any,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "username", "full_name", "phone_number", "email", "status", "avatar"],
            },
          ],
        },
      ],
    });
  }

  async findParentById(id: number | string | bigint): Promise<ParentProfile | null> {
    return ParentProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name", "phone_number", "email", "status", "avatar"],
        },
        {
          model: StudentProfile,
          as: "students",
          attributes: ["student_id", "preferred_language", "dob", "gender", "onboarding_date"],
          through: { attributes: [] } as any,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "username", "full_name", "phone_number", "email", "status", "avatar"],
            },
          ],
        },
      ],
    });
  }

  async findParentProfile(id: number | string | bigint): Promise<ParentProfile | null> {
    return ParentProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name", "phone_number", "email", "status", "avatar"],
        },
        {
          model: StudentProfile,
          as: "students",
          attributes: ["student_id", "dob", "gender", "preferred_language", "onboarding_date", "analytics_enabled"],
          through: { attributes: [] } as any,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "username", "full_name", "email", "phone_number", "avatar", "status"],
            },
            {
              // class_id and section_id are curriculum-service IDs — enriched in parent.service.ts
              model: StudentClassSection,
              as: "classSection",
              attributes: ["class_id", "section_id", "roll_number", "academic_year", "status"],
            },
          ],
        },
      ],
    });
  }

  async updateParent(parent: ParentProfile, data: Record<string, any>): Promise<ParentProfile> {
    return parent.update(data);
  }

  async updateUserById(user_id: number | bigint, data: Record<string, any>): Promise<void> {
    await User.update(data, { where: { user_id } });
  }

  async deleteParentWithRelated(id: number | string | bigint, user_id: number | bigint): Promise<void> {
    const transaction = await sequelize.transaction();
    try {
      const parent = await ParentProfile.findByPk(id, { transaction });
      if (!parent) throw new Error("Parent not found");

      await ParentStudentMap.destroy({ where: { parent_id: id }, transaction });
      await parent.destroy({ transaction });
      await User.destroy({ where: { user_id }, transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export const parentRepository = new ParentRepository();