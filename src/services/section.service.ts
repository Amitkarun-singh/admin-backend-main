import sequelize from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { sectionRepository } from "../repositories/section.repository.js";
import AdminSection from "../models/admin_section.model.js";

interface CreateSectionInput {
  class_id: number;
  section_name: string;
  school_id: number | bigint;
}

interface BulkCreateSectionsInput {
  classes: Array<{
    class_id: number;
    sections: string[];
  }>;
  school_id: number | bigint;
}

interface BulkCreateResult {
  class_id: number;
  sections: AdminSection[];
}

export class SectionService {

  async createSection({ class_id, section_name, school_id }: CreateSectionInput): Promise<AdminSection> {
    if (!class_id || !section_name) {
      throw new ApiError(400, "Class and section name required");
    }
    return sectionRepository.create({ class_id, section_name, school_id });
  }

  async bulkCreateSections({ classes, school_id }: BulkCreateSectionsInput): Promise<BulkCreateResult[]> {
    if (!classes || !Array.isArray(classes)) {
      throw new ApiError(400, "Classes array required");
    }

    const transaction = await sequelize.transaction();
    const createdData: BulkCreateResult[] = [];

    try {
      for (const classItem of classes) {
        const { class_id, sections } = classItem;

        if (!class_id || !sections) {
          throw new ApiError(400, "class_id and sections required");
        }

        const classExists = await sectionRepository.findClassById(class_id);
        if (!classExists) throw new ApiError(404, `Class ${class_id} not found`);

        const sectionRecords: AdminSection[] = [];

        for (const sectionName of sections) {
          const exists = await sectionRepository.findDuplicate(class_id, school_id, sectionName);
          if (exists) continue;

          const section = await sectionRepository.create({ class_id, school_id, section_name: sectionName });
          sectionRecords.push(section);
        }

        createdData.push({ class_id, sections: sectionRecords });
      }

      await transaction.commit();
      return createdData;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getSectionsByClass(class_id: number | string, school_id: number | bigint): Promise<AdminSection[]> {
    return sectionRepository.findByClass(class_id, school_id);
  }

  async updateSection(id: number | string, school_id: number | bigint, body: Partial<AdminSection>): Promise<AdminSection> {
    const section = await sectionRepository.findById(id, school_id);
    if (!section) throw new ApiError(404, "Section not found");
    return sectionRepository.update(section, body);
  }

  async deleteSection(id: number | string, school_id: number | bigint): Promise<void> {
    const section = await sectionRepository.findById(id, school_id);
    if (!section) throw new ApiError(404, "Section not found");
    await sectionRepository.delete(section);
  }
}

export const sectionService = new SectionService();