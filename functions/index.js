const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
});


exports.generateThumbnail = functions.storage.object().onFinalize(object => {

    const fileBucket = object.bucket; // The Storage bucket that contains the file.
    const filePath = object.name; // File path in the bucket.
    const contentType = object.contentType; // File content type.
    const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.
  
    console.log('file bucket is ' + fileBucket)
    console.log('file path is ' + filePath)

    // Exit if this is triggered on a file that is not an image.
    if (!contentType.startsWith('image/')) {
        console.log('This is not an image.');
        return null;
    }
    return generateThumbnailFromFile(fileBucket, filePath, contentType)
    // return null;
})

const generateThumbnailFromFile = (fileBucket, filePath, contentType) => {

    // Get the file name.
    const fileName = path.basename(filePath);
    // Exit if the image is already a thumbnail.
    if (fileName.startsWith('thumb_')) {
        console.log('Already a Thumbnail.');
        return null;
    }

    const bucket = gcs.bucket(fileBucket);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const metadata = {
        contentType: contentType,
    };
    return bucket.file(filePath).download({
            destination: tempFilePath,
        })
        .then(() => {
            console.log('Image downloaded locally to', tempFilePath);
            // Generate a thumbnail using ImageMagick.
            return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath]);
        })
        .then(() => {
            console.log('Thumbnail created at', tempFilePath);
            // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
            const thumbFileName = `thumb_${fileName}`;
            const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
            // Uploading the thumbnail.
            return bucket.upload(tempFilePath, {
                destination: thumbFilePath,
                metadata: metadata,});
            // Once the thumbnail has been uploaded delete the local file to free up disk space.
        })
        .then(() => {
            console.log('thumb file path ' + thumbFilePath);
            fs.unlinkSync(tempFilePath)
            return null;
        });
}