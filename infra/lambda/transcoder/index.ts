import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  MediaConvertClient,
  CreateJobCommand,
} from '@aws-sdk/client-mediaconvert';
import type { S3Event, EventBridgeEvent } from 'aws-lambda';

const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CDN_DOMAIN = process.env.CDN_DOMAIN!;
const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN!;
const MEDIACONVERT_ENDPOINT = process.env.MEDIACONVERT_ENDPOINT!;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const mc = new MediaConvertClient({ endpoint: MEDIACONVERT_ENDPOINT });

/**
 * Find a VIDEO record whose videoUrl contains the given UUID.
 * Since the video library is small (dozens of items), a query + filter is fine.
 */
async function findVideoByUUID(uuid: string) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'VIDEO' },
    })
  );

  return (result.Items || []).find(
    (item) => item.videoUrl && (item.videoUrl as string).includes(uuid)
  );
}

/**
 * Update a VIDEO record's transcoding fields.
 */
async function updateVideoTranscoding(
  sk: string,
  fields: Record<string, unknown>
) {
  const updateFields: string[] = [];
  const exprNames: Record<string, string> = {};
  const exprValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    updateFields.push(`#${key} = :${key}`);
    exprNames[`#${key}`] = key;
    exprValues[`:${key}`] = value;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'VIDEO', sk },
      UpdateExpression: `SET ${updateFields.join(', ')}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    })
  );
}

/**
 * Handle S3 ObjectCreated event — start a MediaConvert transcoding job.
 */
async function handleS3Event(event: S3Event) {
  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.key.replace(/\+/g, ' '));
    console.log(`S3 event: ${key}`);

    // Extract UUID from key: uploads/videos/{UUID}.{ext}
    const match = key.match(/uploads\/videos\/([^.]+)/);
    if (!match) {
      console.log(`Skipping key (no UUID match): ${key}`);
      continue;
    }

    const uuid = match[1];
    const ext = key.split('.').pop() || 'mp4';
    console.log(`Video UUID: ${uuid}, extension: ${ext}`);

    // Find matching DynamoDB record
    const videoRecord = await findVideoByUUID(uuid);
    if (videoRecord) {
      await updateVideoTranscoding(videoRecord.sk as string, {
        transcodingStatus: 'processing',
        transcodingError: '',
      });
      console.log(`Updated video ${videoRecord.id} to processing`);
    } else {
      console.log(`No matching VIDEO record found for UUID ${uuid} (may not be saved yet)`);
    }

    // Create MediaConvert job
    const inputUri = `s3://${BUCKET_NAME}/${key}`;
    const outputUri = `s3://${BUCKET_NAME}/transcoded/${uuid}/`;

    const job = await mc.send(
      new CreateJobCommand({
        Role: MEDIACONVERT_ROLE_ARN,
        UserMetadata: { videoUUID: uuid },
        Settings: {
          Inputs: [
            {
              FileInput: inputUri,
              AudioSelectors: {
                'Audio Selector 1': {
                  DefaultSelection: 'DEFAULT',
                },
              },
              VideoSelector: {},
              TimecodeSource: 'ZEROBASED',
            },
          ],
          OutputGroups: [
            {
              Name: 'HLS',
              OutputGroupSettings: {
                Type: 'HLS_GROUP_SETTINGS',
                HlsGroupSettings: {
                  Destination: outputUri,
                  SegmentLength: 6,
                  MinSegmentLength: 2,
                  ManifestCompression: 'NONE',
                  DirectoryStructure: 'SINGLE_DIRECTORY',
                },
              },
              Outputs: [
                // 480p
                {
                  NameModifier: '_480p',
                  VideoDescription: {
                    Width: 854,
                    Height: 480,
                    CodecSettings: {
                      Codec: 'H_264',
                      H264Settings: {
                        RateControlMode: 'QVBR',
                        MaxBitrate: 1500000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      CodecSettings: {
                        Codec: 'AAC',
                        AacSettings: {
                          Bitrate: 96000,
                          CodingMode: 'CODING_MODE_2_0',
                          SampleRate: 44100,
                        },
                      },
                      AudioSourceName: 'Audio Selector 1',
                    },
                  ],
                  ContainerSettings: {
                    Container: 'M3U8',
                  },
                },
                // 720p
                {
                  NameModifier: '_720p',
                  VideoDescription: {
                    Width: 1280,
                    Height: 720,
                    CodecSettings: {
                      Codec: 'H_264',
                      H264Settings: {
                        RateControlMode: 'QVBR',
                        MaxBitrate: 3000000,
                        QvbrSettings: { QvbrQualityLevel: 8 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      CodecSettings: {
                        Codec: 'AAC',
                        AacSettings: {
                          Bitrate: 128000,
                          CodingMode: 'CODING_MODE_2_0',
                          SampleRate: 48000,
                        },
                      },
                      AudioSourceName: 'Audio Selector 1',
                    },
                  ],
                  ContainerSettings: {
                    Container: 'M3U8',
                  },
                },
                // 1080p
                {
                  NameModifier: '_1080p',
                  VideoDescription: {
                    Width: 1920,
                    Height: 1080,
                    CodecSettings: {
                      Codec: 'H_264',
                      H264Settings: {
                        RateControlMode: 'QVBR',
                        MaxBitrate: 5000000,
                        QvbrSettings: { QvbrQualityLevel: 9 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      CodecSettings: {
                        Codec: 'AAC',
                        AacSettings: {
                          Bitrate: 128000,
                          CodingMode: 'CODING_MODE_2_0',
                          SampleRate: 48000,
                        },
                      },
                      AudioSourceName: 'Audio Selector 1',
                    },
                  ],
                  ContainerSettings: {
                    Container: 'M3U8',
                  },
                },
              ],
            },
          ],
        },
      })
    );

    const jobId = job.Job?.Id || '';
    console.log(`MediaConvert job created: ${jobId}`);

    // Store job ID in DynamoDB record
    if (videoRecord) {
      await updateVideoTranscoding(videoRecord.sk as string, {
        transcodingJobId: jobId,
      });
    }
  }
}

/**
 * MediaConvert job state change event detail type
 */
interface MediaConvertJobDetail {
  status: string;
  userMetadata?: { videoUUID?: string };
  errorCode?: number;
  errorMessage?: string;
  jobId?: string;
  outputGroupDetails?: Array<{
    playlistFilePaths?: string[];
  }>;
}

/**
 * Handle EventBridge MediaConvert job state change — update DynamoDB.
 */
async function handleEventBridgeEvent(
  event: EventBridgeEvent<'MediaConvert Job State Change', MediaConvertJobDetail>
) {
  const detail = event.detail;
  const uuid = detail.userMetadata?.videoUUID;

  if (!uuid) {
    console.log('No videoUUID in user metadata, skipping');
    return;
  }

  console.log(`MediaConvert job ${detail.status} for UUID ${uuid}`);

  const videoRecord = await findVideoByUUID(uuid);
  if (!videoRecord) {
    console.log(`No matching VIDEO record found for UUID ${uuid}`);
    return;
  }

  if (detail.status === 'COMPLETE') {
    const hlsUrl = `https://${CDN_DOMAIN}/transcoded/${uuid}/index.m3u8`;
    await updateVideoTranscoding(videoRecord.sk as string, {
      transcodingStatus: 'complete',
      hlsUrl,
      transcodingError: '',
    });
    console.log(`Video ${videoRecord.id} transcoding complete: ${hlsUrl}`);
  } else if (detail.status === 'ERROR') {
    const errorMsg = detail.errorMessage || `Error code ${detail.errorCode || 'unknown'}`;
    await updateVideoTranscoding(videoRecord.sk as string, {
      transcodingStatus: 'error',
      transcodingError: errorMsg,
    });
    console.error(`Video ${videoRecord.id} transcoding failed: ${errorMsg}`);
  }
}

/**
 * Lambda handler — dispatches based on event source.
 */
export const handler = async (event: any): Promise<void> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // S3 event
  if (event.Records && event.Records[0]?.eventSource === 'aws:s3') {
    return handleS3Event(event as S3Event);
  }

  // EventBridge event
  if (event.source === 'aws.mediaconvert') {
    return handleEventBridgeEvent(event);
  }

  console.log('Unknown event source, skipping');
};
