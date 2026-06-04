
const curriculamServer = process.env.CURRICULAM_SERVER_URL

class CurriculumService {

    async  allClass() {
        const res = await fetch(`${curriculamServer}/api/v1/class/all`)

        return res.json()
    }

    async onlyAsignClass(userId,schoolId){
         const res = await fetch(`${curriculamServer}/api/v1/class?userId=${userId}&schoolId=${schoolId}`)

        return res.json()
    }

     async  allSubject(classId,board,streamId) {
        const res = await fetch(`${curriculamServer}/api/v1/class/${classId}/subject/all?board=${board}&streamId=${streamId}`)

        return res.json()
    }

    async onlyAsignSubject(classId,board,streamId,userId,schoolId){
         const res = await fetch(`${curriculamServer}/api/v1/class/${classId}/subject/all?board=${board}&streamId=${streamId}&userId=${userId}8&schoolId=${schoolId}`)

        return res.json()
    }
    
    async stream(){
         const res = await fetch(`${curriculamServer}/api/v1/stream`)

        return res.json()
    }

      async  allChapter({classId,board,streamId,subjectId,lang}) {
        console.log("classId ",classId)
        const res = await fetch(`${curriculamServer}/api/v1/class/${classId}/subject/${subjectId}/chapter/all?board=${board}&streamId=${streamId}&lang=${lang}`)

        return res.json()
    }

    async onlyAsignChapter({classId,board,streamId,userId,schoolId,subjectId,lang}){
         const res = await fetch(`${curriculamServer}/api/v1/class/${classId}/subject/${subjectId}/chapter?board=${board}&streamId=${streamId}&userId=${userId}&schoolId=${schoolId}&lang=${lang}`)

        return res.json()
    }
}

export default new CurriculumService()