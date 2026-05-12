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
}

export default new ClassRepository();
