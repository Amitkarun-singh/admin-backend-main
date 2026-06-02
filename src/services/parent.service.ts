import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { parentRepository } from "../repositories/parent.repository.js";
import ParentProfile from "../models/parent_profile.model.js";

const VALID_RELATIONS = ["father", "mother", "guardian"];

interface CreateParentInput {
  school_id: number | bigint;
  username: string;
  password: string;
  phone_number?: string;
  email?: string;
  full_name?: string;
  parent_name?: string;
  relation?: string;
}

interface UpdateParentInput {
  user_id?: any;
  school_id?: any;
  relation?: string;
  [key: string]: any;
}

export class ParentService {

  async createParent(input: CreateParentInput): Promise<ParentProfile> {
    const { school_id, username, password, phone_number, email, full_name, parent_name, relation } = input;

    if (!username || !password)
      throw new ApiError(400, "Required fields missing: username, password");

    if (relation && !VALID_RELATIONS.includes(relation))
      throw new ApiError(400, `Invalid relation. Must be one of: ${VALID_RELATIONS.join(", ")}`);

    const transaction = await sequelize.transaction();

    try {
      const parentRole = await parentRepository.findRoleByName("PARENT", transaction);
      if (!parentRole) throw new ApiError(400, "Parent role not found");

      const hashed = await bcrypt.hash(password, 10);

      const parentUser = await parentRepository.createUser({
        username, full_name: full_name || null,
        password: hashed, phone_number: phone_number || null,
        email: email || null, role_id: parentRole.role_id,
        school_id, status: "Active", is_password_reset_required: true,
      }, transaction);

      const parent = await parentRepository.createParentProfile({
        user_id: parentUser.user_id, school_id,
        parent_name: parent_name || null,
        relation: relation || null,
      }, transaction);

      await transaction.commit();
      return parent;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getAllParents(school_id: number | bigint): Promise<ParentProfile[]> {
    return parentRepository.findAllParents(school_id);
  }

  async getParentById(id: number | string | bigint): Promise<ParentProfile> {
    const parent = await parentRepository.findParentById(id);
    if (!parent) throw new ApiError(404, "Parent not found");
    return parent;
  }

  async getParentProfile(id: number | string | bigint): Promise<ParentProfile> {
    const parent = await parentRepository.findParentProfile(id);
    if (!parent) throw new ApiError(404, "Parent not found");
    return parent;
  }

  async updateParent(id: number | string | bigint, body: UpdateParentInput): Promise<ParentProfile> {
    const parent = await parentRepository.findParentById(id);
    if (!parent) throw new ApiError(404, "Parent not found");

    const { user_id, school_id, ...allowedUpdates } = body;

    if (allowedUpdates.relation && !VALID_RELATIONS.includes(allowedUpdates.relation))
      throw new ApiError(400, `Invalid relation. Must be one of: ${VALID_RELATIONS.join(", ")}`);

    return parentRepository.updateParent(parent, allowedUpdates);
  }

  async deleteParent(id: number | string | bigint): Promise<void> {
    const parent = await parentRepository.findParentById(id);
    if (!parent) throw new ApiError(404, "Parent not found");

    const user_id = (parent as any).user_id;
    await parentRepository.deleteParentWithRelated(id, user_id);
  }
}

export const parentService = new ParentService();