/**
 * S3 Service - Profile Image Upload
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

// 환경변수에서 credentials를 명시적으로 설정
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined, // credentials가 없으면 기본 provider chain 사용
});

const S3_BUCKET = process.env.S3_BUCKET || 'knowledge-base-test-6575574';

export class S3Service {
  /**
   * Upload profile image to S3
   */
  async uploadProfileImage(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<string> {
    const extension = originalName.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const key = `${userId}/profile_image/profile_${timestamp}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await s3Client.send(command);

    // Return the S3 URL
    const imageUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;
    console.log(`[S3Service] Profile image uploaded: ${imageUrl}`);
    
    return imageUrl;
  }

  /**
   * Delete profile image from S3
   */
  async deleteProfileImage(imageUrl: string): Promise<void> {
    try {
      // Extract key from URL
      const urlParts = imageUrl.split('.s3.amazonaws.com/');
      if (urlParts.length < 2) return;
      
      const key = urlParts[1];

      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      });

      await s3Client.send(command);
      console.log(`[S3Service] Profile image deleted: ${key}`);
    } catch (error) {
      console.error('[S3Service] Error deleting image:', error);
    }
  }

  /**
   * Delete entire user folder from S3 (for account deletion)
   */
  async deleteUserFolder(userId: string): Promise<void> {
    try {
      console.log(`[S3Service] Deleting all objects for user: ${userId}`);
      
      // List all objects with the userId prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: `${userId}/`,
      });

      const listResponse = await s3Client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        console.log(`[S3Service] No objects found for user: ${userId}`);
        return;
      }

      // Delete all objects
      const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key! }));
      
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: S3_BUCKET,
        Delete: {
          Objects: objectsToDelete,
        },
      });

      const deleteResponse = await s3Client.send(deleteCommand);
      
      console.log(`[S3Service] Deleted ${deleteResponse.Deleted?.length || 0} objects for user: ${userId}`);
      
      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        console.error(`[S3Service] Errors deleting some objects:`, deleteResponse.Errors);
      }
    } catch (error) {
      console.error('[S3Service] Error deleting user folder:', error);
      // Don't throw - we want account deletion to succeed even if S3 cleanup fails
    }
  }
}

let s3ServiceInstance: S3Service | null = null;

export function getS3Service(): S3Service {
  if (!s3ServiceInstance) {
    s3ServiceInstance = new S3Service();
  }
  return s3ServiceInstance;
}
