import { Op } from "sequelize";
import AdminClass from "../models/admin_class.model.js";

export class ClassRepository {
  async findByName(class_name: string) {
    return await AdminClass.findOne({ where: { class_name } });
  }

  async findByNames(class_names: string[]) {
    return await AdminClass.findAll({
      where: {
        class_name: {
          [Op.in]: class_names
        }
      }
    });
  }

  async findById(class_id: number | string) {
    return await AdminClass.findByPk(class_id);
  }

  async findSectionById(section_id: number | string) {
    const AdminSection = (await import("../models/admin_section.model.js")).default;
    return await AdminSection.findByPk(section_id);
  }
}

export default new ClassRepository();
