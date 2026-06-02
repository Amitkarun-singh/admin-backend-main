import AdminSection from "../models/admin_section.model.js";
import AdminClass from "../models/admin_class.model.js";

export class SectionRepository {

  async create(data: {
    class_id: number;
    section_name: string;
    school_id: number | bigint;
  }): Promise<AdminSection> {
    return AdminSection.create(data);
  }

  async findDuplicate(class_id: number, school_id: number | bigint, section_name: string): Promise<AdminSection | null> {
    return AdminSection.findOne({ where: { class_id, school_id, section_name } });
  }

  async findByClass(class_id: number | string, school_id: number | bigint): Promise<AdminSection[]> {
    return AdminSection.findAll({ where: { class_id, school_id } });
  }

  async findById(section_id: number | string, school_id: number | bigint): Promise<AdminSection | null> {
    return AdminSection.findOne({ where: { section_id, school_id } });
  }

  async update(section: AdminSection, body: Partial<AdminSection>): Promise<AdminSection> {
    return section.update(body);
  }

  async delete(section: AdminSection): Promise<void> {
    await section.destroy();
  }

  async findClassById(class_id: number | string): Promise<AdminClass | null> {
    return AdminClass.findByPk(class_id);
  }
}

export const sectionRepository = new SectionRepository();