import AdminRole from "../models/admin_role.model.js";

export class RoleRepository {
  async findByName(role_name: string) {
    return await AdminRole.findOne({ where: { role_name } });
  }

  async findById(role_id: number | string) {
    return await AdminRole.findByPk(role_id);
  }
}

export default new RoleRepository();
