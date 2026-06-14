const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/* =========================
   FILE UPLOAD SETUP
========================= */

const upload = multer({
    dest: "uploads/"
});
/* =========================
   GEMINI SETUP
========================= */

const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

/* =========================
   HELPERS
========================= */

function extractJson(text) {

    let cleaned = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const firstBrace =
        cleaned.indexOf("{");

    const lastBrace =
        cleaned.lastIndexOf("}");

    if (
        firstBrace !== -1 &&
        lastBrace !== -1
    ) {
        cleaned =
            cleaned.substring(
                firstBrace,
                lastBrace + 1
            );
    }

    return JSON.parse(cleaned);

}

async function searchYoutube(query) {

    const response =
        await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
                params: {
                    part: "snippet",
                    q: query,
                    key:
                        process.env.YOUTUBE_API_KEY,
                    maxResults: 1,
                    type: "video"
                }
            }
        );

    const item =
        response.data.items[0];

    return {

        title:
            item.snippet.title,

        videoId:
            item.id.videoId

    };

}

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {

    res.json({
        success: true,
        message:
            "Learnopedia Backend Running 🚀"
    });

});

/* =========================
   ROADMAP GENERATOR
========================= */

app.post("/api/roadmap", async (req, res) => {

    try {

        const { syllabus } =
            req.body;

        console.log(
            "Received:",
            syllabus
        );

const prompt = `
You are Learnopedia AI.

Generate a complete learning roadmap.

Learning Goal:
${syllabus}

Return ONLY valid JSON.

{
  "course":"",
  "modules":[
    {
      "title":"",
      "duration":"",
      "topics":[]
    }
  ]
}

IMPORTANT:

For EVERY module generate 5-10 specific topics.

Example:

{
  "title":"Foundations of Product Management",
  "duration":"2 Weeks",
  "topics":[
    "Introduction to Product Management",
    "Role of a Product Manager",
    "Product Lifecycle",
    "Stakeholder Management",
    "Product Discovery"
  ]
}

Do NOT leave topics empty.
`;

        const result =
            await model.generateContent(
                prompt
            );

        const response =
            result.response.text();

        const roadmap =
            extractJson(
                response
            );

        res.json(
            roadmap
        );

    }
    catch(error){

        console.error(
            "Roadmap Error:",
            error
        );

        res.status(500).json({
            success:false,
            message:
                "Roadmap generation failed"
        });

    }

});

/* =========================
   MODULE LESSON GENERATOR
========================= */

app.post("/api/module", async (req, res) => {

    try {

        const { module,topic } =
            req.body;

        console.log(
            "Generating lesson:",
            topic
        );

        const prompt = `
You are Learnopedia AI Teacher.

Create a complete lesson for:

Topic:
${topic}

Module:
${module}

Teach ONLY this topic.
Do not explain other topics.

Return ONLY JSON.

{
  "title":"",
  "introduction":"",
  "sections":[
    {
      "heading":"",
      "content":""
    }
  ],
  "summary":"",
  "quiz":[
    {
      "question":"",
      "answer":""
    }
  ]
}

Requirements:

- Beginner friendly
- 5 sections
- Detailed explanations
- Summary
- 5 quiz questions
`;

        const result =
            await model.generateContent(
                prompt
            );

        const response =
            result.response.text();
console.log("===== LESSON RESPONSE =====");
console.log(response);
console.log("===========================");
        const lesson =
            extractJson(
                response
            );

        res.json(
            lesson
        );

    }
    catch(error){

        console.error(
            "Lesson Error:",
            error
        );

        res.status(500).json({
            success:false,
            message:
                "Lesson generation failed"
        });

    }

});

/* =========================
   VIDEO PATH GENERATOR
========================= */

app.post("/api/videos", async (req, res) => {

    try {

        const {
    module,
    topic
} = req.body;

        console.log(
            "Generating video path for:",
            module
        );

        const prompt = `
You are Learnopedia AI.
Create 5 YouTube videos for learning this topic.

Module:
${module}

Topic:
${topic}

Return ONLY JSON.

{
  "videos":[
    {
      "title":"",
      "search":""
    }
  ]
}

Return ONLY JSON.

{
  "videos":[
    {
      "level":"Beginner",
      "search":""
    },
    {
      "level":"Intermediate",
      "search":""
    },
    {
      "level":"Advanced",
      "search":""
    }
  ]
}
`;

        const result =
            await model.generateContent(
                prompt
            );

        const response =
            result.response.text();

        const generated =
            extractJson(
                response
            );

        const finalVideos = [];

        for (
            const video of generated.videos
        ) {

            const yt =
                await searchYoutube(
                    video.search
                );

            finalVideos.push({

    title:
        yt.title,

    videoId:
        yt.videoId

});

        }

        res.json({
            videos:
                finalVideos
        });

    }
    catch(error){

        console.error(
            "Video Error:",
            error
        );

        res.status(500).json({
            success:false,
            message:
                "Video generation failed"
        });

    }

});
/* =========================
   PDF ROADMAP GENERATOR
========================= */

app.post(
    "/api/upload-pdf",
    upload.single("pdf"),
    async (req, res) => {
        console.log("🔥 PDF ROUTE HIT");

        try {

            const pdfBuffer =
                fs.readFileSync(
                    req.file.path
                );

            const pdfData =
                await pdfParse(
                    pdfBuffer
                );

            const syllabusText =
                pdfData.text;

            console.log(
                "PDF Extracted:"
            );

            console.log(
                syllabusText.substring(
                    0,
                    500
                )
            );
const prompt = `
You are a university syllabus analyzer.

Read the syllabus carefully.

Your task:

1. Identify the course name.
2. Identify ALL units/modules.
3. For EACH module:
   - Extract the module title.
   - Extract EVERY topic explicitly mentioned.
4. NEVER invent topics.
5. NEVER add topics not present in the syllabus.
6. If topics are not listed, return an empty array.

Return ONLY valid JSON.

{
  "course":"",
  "modules":[
    {
      "title":"",
      "duration":"",
      "topics":[]
    }
  ]
}

SYLLABUS:

${syllabusText}
`;
            const result =
                await model.generateContent(
                    prompt
                );

            const response =
                result.response.text();
            console.log("===== GEMINI PDF RESPONSE =====");
console.log(response);
console.log("===============================");

            const roadmap =
                extractJson(
                    response
                );

            fs.unlinkSync(
                req.file.path
            );

            res.json(
                roadmap
            );

        } catch(error){

            console.error(
                "PDF Error:",
                error
            );

            res.status(500).json({
                success:false,
                message:
                    "PDF processing failed"
            });

        }

    }
);
/* =========================
   SERVER
========================= */

const PORT =
    process.env.PORT ||
    5000;

app.listen(PORT, () => {

    console.log(
        `🚀 Server running on port ${PORT}`
    );

});