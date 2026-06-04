import AdminClass from "../models/admin_class.model.js";
import AdminSection from "../models/admin_section.model.js";
import AdminSchool from "../models/admin_school.model.js";
import AdminClassCourseMap from "../models/admin_class_course_map.model.js";
import { Op } from "sequelize";
import sequelize from "../config/db.js";

export class ClassRepository {

  async create(class_name: string): Promise<AdminClass> {
    return AdminClass.create({ class_name });
  }

  async findByName(class_name: string): Promise<AdminClass | null> {
    return AdminClass.findOne({ where: { class_name } });
  }

  async findAll(): Promise<AdminClass[]> {
    return AdminClass.findAll({ order: [["class_id", "ASC"]] });
  }

  async findById(id: number | string): Promise<AdminClass | null> {
    return AdminClass.findByPk(id);
  }

  async update(classData: AdminClass, body: Partial<AdminClass>): Promise<AdminClass> {
    return classData.update(body);
  }

  async deleteWithRelated(id: number | string): Promise<void> {
    const transaction = await sequelize.transaction();
    try {
      const classData = await AdminClass.findByPk(id, { transaction });
      if (!classData) throw new Error("Class not found");

      await AdminSection.destroy({ where: { class_id: id }, transaction });
      await AdminClassCourseMap.destroy({ where: { class_id: id }, transaction });
      await classData.destroy({ transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findSchoolById(school_id: number | string): Promise<AdminSchool | null> {
    return AdminSchool.findOne({ where: { school_id } });
  }

  async findSectionById(section_id: number | string): Promise<AdminSection | null> {
    return AdminSection.findByPk(section_id);
  }

  async findByNames(names: string[]): Promise<AdminClass[]> {
    return AdminClass.findAll({ where: { class_name: { [Op.in]: names } } });
  }
}

export const classRepository = new ClassRepository();