import sequelize from "../config/db.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSubjectMaster from "../models/admin_subject_master.model.js";
import AdminClassSubject from "../models/admin_class_subject.model.js";
import AdminChapterMaster from "../models/admin_chapter_master.model.js";


/* =====================================================
    ADD SUBJECTS + CHAPTERS USING CLASS NAME
   ===================================================== */
export const addSubjectsWithChapters = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { class_name, subjects } = req.body;

        if (!class_name || !subjects?.length) {
            return res.status(400).json({
                success: false,
                message: "class_name and subjects are required"
            });
        }

        /* 1️⃣ Find Class by Name */
        const classData = await AdminClass.findOne({
            where: { class_name }
        });

        if (!classData) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        for (const subjectData of subjects) {

        const { subject_name, chapters } = subjectData;

        if (!subject_name || !chapters?.length) {
            throw new Error("Each subject must have subject_name and chapters");
        }

        /* 2️⃣ Create or Find Subject */
        let subject = await AdminSubjectMaster.findOne({
            where: { subject_name }
        });

        if (!subject) {
            subject = await AdminSubjectMaster.create(
            { subject_name },
            { transaction }
            );
        }

        /* 3️⃣ Map Subject to Class */
        const classSubject = await AdminClassSubject.create(
            {
            class_id: classData.class_id,
            subject_id: subject.subject_id,
            language: "English",
            ai_enabled: false,
            status: "active"
            },
            { transaction }
        );

        /* 4️⃣ Create Chapters */
        const chapterPayload = chapters.map((chapterName, index) => ({
            subject_id: subject.subject_id,
            chapter_name: chapterName,
            chapter_order: index + 1,
            status: "active"
        }));

        await AdminChapterMaster.bulkCreate(chapterPayload, { transaction });
        }

        await transaction.commit();

        return res.status(201).json({
        success: true,
        message: "Subjects and Chapters added successfully"
        });

    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({
        success: false,
        message: error.message
        });
    }
};

/* =====================================================
   GET SUBJECTS BY CLASS NAME
   ===================================================== */
export const getSubjectsByClassName = async (req, res) => {
  try {
    const { class_name } = req.params;

    const classData = await AdminClass.findOne({
      where: { class_name }
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    const subjects = await AdminClassSubject.findAll({
      where: {
        class_id: classData.class_id,
        status: "active"
      },
      include: [
        {
          model: AdminSubjectMaster,
          as: "subject",
          attributes: ["subject_id", "subject_name"]
        }
      ]
    });

    return res.status(200).json({
      success: true,
      data: subjects.map(s => s.subject)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* =====================================================
   GET CHAPTERS BY CLASS NAME + SUBJECT
   ===================================================== */
export const getChaptersByClassAndSubject = async (req, res) => {
  try {
    const { class_name, subject_id } = req.params;

    const classData = await AdminClass.findOne({
      where: { class_name }
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    const mapping = await AdminClassSubject.findOne({
      where: {
        class_id: classData.class_id,
        subject_id,
        status: "active"
      }
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: "Subject not mapped to this class"
      });
    }

    const chapters = await AdminChapterMaster.findAll({
      where: {
        subject_id,
        status: "active"
      },
      order: [["chapter_order", "ASC"]]
    });

    return res.status(200).json({
      success: true,
      data: chapters
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*  =====================================================
    Update Subject Name (For Class)
    ====================================================== */
    export const updateSubjectName = async (req, res) => {
    try {
        const { subject_id } = req.params;
        const { subject_name } = req.body;

        if (!subject_name) {
        return res.status(400).json({
            success: false,
            message: "subject_name is required"
        });
        }

        const subject = await AdminSubjectMaster.findByPk(subject_id);

        if (!subject) {
        return res.status(404).json({
            success: false,
            message: "Subject not found"
        });
        }

        subject.subject_name = subject_name;
        await subject.save();

        return res.status(200).json({
        success: true,
        message: "Subject updated successfully"
        });

    } catch (error) {
        return res.status(500).json({
        success: false,
        message: error.message
        });
    }
};

/*  =====================================================
    Delete Subject from Class 
    ====================================================== */
export const deleteSubjectFromClass = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { class_name, subject_id } = req.params;

        const classData = await AdminClass.findOne({
        where: { class_name }
        });

        if (!classData) {
        return res.status(404).json({
            success: false,
            message: "Class not found"
        });
        }

        // Delete class-subject mapping
        await AdminClassSubject.destroy({
        where: {
            class_id: classData.class_id,
            subject_id
        },
        transaction
        });

        // Optional: Delete chapters
        await AdminChapterMaster.destroy({
        where: { subject_id },
        transaction
        });

        await transaction.commit();

        return res.status(200).json({
        success: true,
        message: "Subject deleted from class"
        });

    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({
        success: false,
        message: error.message
        });
    }
};

/*  =====================================================
    Add Chapters To Existing Subject
    ====================================================== */
export const addChaptersToSubject = async (req, res) => {
  try {
    const { subject_id } = req.params;
    const { chapters } = req.body;

    if (!chapters?.length) {
      return res.status(400).json({
        success: false,
        message: "chapters array required"
      });
    }

    const chapterPayload = chapters.map((name, index) => ({
      subject_id,
      chapter_name: name,
      chapter_order: index + 1,
      status: "active"
    }));

    await AdminChapterMaster.bulkCreate(chapterPayload);

    return res.status(201).json({
      success: true,
      message: "Chapters added successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*  =====================================================
    Update Chapter
    ====================================================== */
export const updateChapter = async (req, res) => {
  try {
    const { chapter_id } = req.params;
    const { chapter_name } = req.body;

    const chapter = await AdminChapterMaster.findByPk(chapter_id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found"
      });
    }

    chapter.chapter_name = chapter_name;
    await chapter.save();

    return res.status(200).json({
      success: true,
      message: "Chapter updated successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*  =====================================================
    Delete Chapter
    ====================================================== */
export const deleteChapter = async (req, res) => {
  try {
    const { chapter_id } = req.params;

    const deleted = await AdminChapterMaster.destroy({
      where: { chapter_id }
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chapter deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};