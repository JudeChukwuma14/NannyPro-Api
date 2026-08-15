
const mutler = require("multer")

const storage = mutler.memoryStorage()

const fileFilter = (req, file, cb) => {
    const allowedFileTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"]

    if (allowedFileTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error("Invalid file type"), false)
    }
}

const upload = mutler({
    storage,
    fileFilter,
    limits: { fileSize: 1024 * 1024 * 5 }
}).array("images", 10)

module.exports = upload