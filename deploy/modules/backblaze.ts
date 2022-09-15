import { isNumber, isObject, isString } from "../../src/deps/just.ts";
import { hexEncode } from "../deps/std.ts";

export class BackBlaze {
  #applicationKeyId: string;
  #applicationKey: string;

  #auth: AuthorizeData | undefined;

  get downloadUrl() {
    if (!this.#auth) {
      throw new Error("Must authorize account before accessing the url.");
    }

    return this.#auth.downloadUrl;
  }

  constructor(props: BackBlazeProps) {
    this.#applicationKey = props.applicationKey;
    this.#applicationKeyId = props.applicationKeyId;
  }

  /**
   * Get the download path for the provided file.
   *
   * File should not have a leading `/`.
   */
  fileUrl(bucketName: string, fileName: string) {
    return new URL(`/file/${bucketName}/${fileName}`, this.downloadUrl);
  }

  /**
   * Used to log in to the B2 API. Saves an authorization token that can be used
   * for account-level operations, and a URL that should be used as the base URL
   * for subsequent API calls.
   *
   * You can use either the master application key or a normal application key.
   *
   * You'll find the master application key on the B2 Cloud Storage Buckets page
   * on the web site. When using the master application key, use your "master
   * application key ID" and the "application key" you got from the site.
   *
   * Master Application Key: This is the first key you have access to, it is
   * available on the web application. This key has all capabilities, access to
   * all buckets, and has no file prefix restrictions or expiration.
   *
   * Application Key(s) [non-master]: These are other keys created by you and
   * can be limited to a bucket, with a specific file prefix and can expire.
   * Normal application keys come from the b2_create_key call. When using one of
   * them, the "application key ID" and "application key" are the ones returned
   * when you created the key.
   */
  async authorizeAccount(): Promise<
    JsonResponse<AuthorizeData, "b2_authorize_account">
  > {
    const headers = new Headers();
    const encoded = btoa(`${this.#applicationKeyId}:${this.#applicationKey}`);
    headers.set("Authorization", `Basic ${encoded}`);

    const response = await fetch(
      "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
      { headers },
    );

    const data = await response.json();

    if (isJsonError<"b2_authorize_account">(data)) {
      return { success: false, error: data };
    }

    this.#auth = data;
    return { success: true, data };
  }

  /**
   * Cancels the upload of a large file, and deletes all of the parts that have
   * been uploaded.
   *
   * This will return an error if there is no active upload with the given file
   * ID.
   *
   * This will also throw an error if the instance has not been authenticated or
   * the token doesn't have the `writeFiles` capability.
   */
  async cancelLargeFile(
    fileId: string,
  ): Promise<JsonResponse<CancelLargeFileData, "b2_cancel_large_file">> {
    const { headers, url } = this.#getAuthDetails("b2_cancel_large_file", [
      "writeFiles",
    ]);

    const body = JSON.stringify({ fileId });
    const response = await fetch(url, { body, headers, method: "POST" });
    const data = await response.json();

    if (isJsonError<"b2_cancel_large_file">(data)) {
      return { success: false, error: data };
    }

    return { success: true, data };
  }

  async createBucket(props: CreateBucketProps): Promise<
    JsonResponse<CreateBucketData, "b2_create_bucket">
  > {
    const capabilities: Capability[] = ["writeBuckets"];

    if (props.fileLockEnabled) {
      capabilities.push("writeBucketRetentions");
    }

    if (props.defaultServerSideEncryption) {
      capabilities.push("writeBucketEncryption");
    }

    const { headers, url } = this.#getAuthDetails(
      "b2_create_bucket",
      capabilities,
    );

    const body = JSON.stringify(props);
    const response = await fetch(url, { body, headers, method: "POST" });
    const data = await response.json();

    if (isJsonError<"b2_create_bucket">(data)) {
      return { success: false, error: data };
    }

    return { success: true, data };
  }

  /**
   * Gets an URL to use for uploading files.
   *
   * When you upload a file to B2, you must call `getUploadUrl` first to get the
   * URL for uploading. Then, you use `uploadFile` on this URL to upload your
   * file.
   *
   * An `uploadUrl` and upload `authorizationToken` are valid for 24 hours or
   * until the endpoint rejects an upload, see `uploadFile`. You can upload as
   * many files to this URL as you need. To achieve faster upload speeds,
   * request multiple uploadUrls and upload your files to these different
   * endpoints in parallel.
   *
   * @param bucketId The ID of the bucket that you want to upload to.
   */
  async getUploadUrl(
    bucketId: string,
  ): Promise<JsonResponse<GetUploadUrlData, "b2_get_upload_url">> {
    const { headers, url } = this.#getAuthDetails("b2_get_upload_url", [
      "writeFiles",
    ]);

    const body = JSON.stringify({ bucketId });
    const response = await fetch(url, { body, headers, method: "POST" });
    const data = await response.json();

    if (isJsonError<"b2_get_upload_url">(data)) {
      return { success: false, error: data };
    }

    return { success: true, data };
  }

  /**
   * Lists the names of all files in a bucket, starting at a given name.
   *
   * This call returns at most 1000 file names per transaction, but it can be
   * called repeatedly to scan through all of the file names in a bucket. Each
   * time you call, it returns a "nextFileName" that can be used as the starting
   * point for the next call.
   *
   * There may be many file versions for the same name, but this call will
   * return each name only once. Files that have been hidden will not be
   * returned; to see all versions of a file, including hide markers, use
   * `listFileVersions()` instead.
   */
  async listFileNames(
    props: ListFileNameProps,
  ): Promise<JsonResponse<ListFileNameData, "b2_list_file_names">> {
    const { headers, url } = this.#getAuthDetails("b2_list_file_names", [
      "listFiles",
    ]);

    const body = JSON.stringify(props);
    const response = await fetch(url, { body, headers, method: "POST" });
    const data = await response.json();

    if (isJsonError<"b2_list_file_names">(data)) {
      return { success: false, error: data };
    }

    return { success: true, data };
  }

  /**
   * Uploads one file to B2, returning its unique file ID.
   */
  async uploadFile(
    file: Uint8Array,
    props: UploadFileProps,
  ): Promise<JsonResponse<FileData, "b2_upload_file">> {
    const headers = new Headers([
      ["Authorization", props.authorizationToken],
      ["X-Bz-File-Name", props.fileName],
      ["Content-Type", props.contentType],
      ["Content-Length", props.contentLength + ""],
      ["X-Bz-Content-Sha1", props.sha1 ?? await getChecksum(file)],
    ]);

    if (props.lastModified) {
      headers.set(
        "X-Bz-Info-src_last_modified_millis",
        props.lastModified,
      );
    }

    if (props.contentDisposition) {
      headers.set("X-Bz-Info-b2-content-disposition", props.contentDisposition);
    }

    if (props.contentLanguage) {
      headers.set("X-Bz-Info-b2-content-language", props.contentLanguage);
    }

    if (props.expires) {
      headers.set("X-Bz-Info-b2-expires", props.expires);
    }

    if (props.cacheControl) {
      headers.set("X-Bz-Info-b2-cache-control", props.cacheControl);
    }

    if (props.contentEncoding) {
      headers.set("X-Bz-Info-b2-content-encoding", props.contentEncoding);
    }

    if (props.info) {
      headers.set("X-Bz-Info-*", props.info);
    }

    if (props.fileLegalHold) {
      headers.set("X-Bz-File-Legal-Hold", props.fileLegalHold);
    }

    if (props.fileRetentionMode) {
      headers.set("X-Bz-File-Retention-Mode", props.fileRetentionMode);
    }

    if (props.fileRetentionRetainUntilTimestamp) {
      headers.set(
        "X-Bz-File-Retention-Retain-Until-Timestamp",
        props.fileRetentionRetainUntilTimestamp + "",
      );
    }

    if (props.serverSideEncryption) {
      headers.set("X-Bz-Server-Side-Encryption", props.serverSideEncryption);
    }

    if (props.serverSideEncryptionCustomerAlgorithm) {
      headers.set(
        "X-Bz-Server-Side-Encryption-Customer-Algorithm",
        props.serverSideEncryptionCustomerAlgorithm,
      );
    }

    if (props.serverSideEncryptionCustomerKey) {
      headers.set(
        "X-Bz-Server-Side-Encryption-Customer-Key",
        props.serverSideEncryptionCustomerKey,
      );
    }

    if (props.serverSideEncryptionCustomerKeyMd5) {
      headers.set(
        "X-Bz-Server-Side-Encryption-Customer-Key-Md5",
        props.serverSideEncryptionCustomerKeyMd5,
      );
    }

    const response = await fetch(props.uploadUrl, {
      body: file,
      headers,
      method: "POST",
    });
    const data = await response.json();

    if (isJsonError<"b2_upload_file">(data)) {
      return { success: false, error: data };
    }

    return { success: true, data };
  }

  #getAuthDetails(endpoint: Endpoint, capabilities: Capability[] = []) {
    if (!this.#auth) {
      throw new Error(
        "BackBlaze instance is not authorized, must call `authorizeAccount()` first.",
      );
    }

    const { authorizationToken, apiUrl, allowed } = this.#auth;

    if (
      !capabilities.every((capability) =>
        allowed.capabilities.includes(capability)
      )
    ) {
      throw new Error(
        `The auth token must have the following capabilities: ${
          capabilities.map((c) => JSON.stringify(c)).join(", ")
        } permission to do this.`,
      );
    }

    const headers = new Headers();
    headers.set("Authorization", authorizationToken);

    return { headers, url: new URL(`/b2api/v2/${endpoint}`, apiUrl) };
  }
}

function isJsonError<Key extends keyof JsonErrorMap = keyof JsonErrorMap>(
  value: unknown,
): value is JsonErrorMap[Key] {
  return isObject(value) && isNumber(value.status) && isString(value.code);
}

function textDecoder(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

async function getChecksum(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return textDecoder(hexEncode(new Uint8Array(digest)));
}

interface BackBlazeProps {
  applicationKeyId: string;
  applicationKey: string;
}

interface CreateBucketData {
  /**
   * The account that the bucket is in.
   */
  accountId: string;
  /**
   * The unique ID of the bucket.
   */
  bucketId: string;
  /**
   * The unique name of the bucket
   */
  bucketName: string;
  /**
   * One of: allPublic, allPrivate, snapshot, or other values added in the future.
   * allPublic means that anybody can download the files is the bucket; allPrivate
   * means that you need an authorization token to download them; snapshot means
   * that it's a private bucket containing snapshots created on the B2 web site.
   */
  bucketType: "allPublic" | "allPrivate" | "snapshot";
  /**
   * The user data stored with this bucket.
   */
  bucketInfo: Record<string, string>;
  /**
   * The CORS rules for this bucket. See CORS Rules for an overview and the rule
   * structure.
   */
  corsRules: CorsRules[];
  /**
   * The File Lock configuration for this bucket.
   *
   * This field is filtered based on application key capabilities;
   * readBucketRetentions capability is required to access the value. See File
   * Lock for more details on response structure."
   */
  fileLockConfiguration: {
    isClientAuthorizedToRead: boolean;
    value: {
      defaultRetention:
        | {
          mode: "governance" | "compliance";
          period: {
            duration: number;
            unit: "days" | "years";
          };
        }
        | { mode: null; period: null };
      isFileLockEnabled: boolean;
    } | null;
  };

  /**
   * The default bucket Server-Side Encryption settings for new files uploaded to
   * this bucket.
   *
   * This field is filtered based on application key capabilities;
   * readBucketEncryption capability is required to access the value. See
   * Server-Side Encryption for more details on response structure."
   */
  defaultServerSideEncryption: object;
  /**
   * The list of lifecycle rules for this bucket. See Lifecycle Rules for an
   * overview and the rule structure.
   */
  lifecycleRules: LifecycleRule[];
  /**
   * The list of replication rules for this bucket. See Cloud Replication Rules
   * for an overview and the rule structure.
   */
  replicationConfiguration: ReplicationConfiguration;
  /**
   * A counter that is updated every time the bucket is modified, and can be used
   * with the ifRevisionIs parameter to b2_update_bucket to prevent colliding,
   * simultaneous updates.
   */
  revision: number;
  /**
   * When present and set to s3, the bucket can be accessed through the S3
   * Compatible API.
   */
  options: string[] | "s3";
}

interface CreateBucketProps {
  /**
   * Your account ID.
   */
  accountId: string;

  /**
   * The name to give the new bucket.
   *
   * Bucket names must be a minimum of 6 and a maximum of 50 characters long,
   * and must be globally unique; two different B2 accounts cannot have buckets
   * with the name name. Bucket names can consist of: letters, digits, and
   * ""-"". Bucket names cannot start with ""b2-""; these are reserved for
   * internal Backblaze use."
   */
  bucketName: string;

  /**
   * Either "allPublic", meaning that files in this bucket can be downloaded by
   * anybody, or "allPrivate", meaning that you need a bucket authorization
   * token to download the files.
   */
  bucketType: "appPublic" | "allPrivate";

  /**
   * User-defined information to be stored with the bucket: a JSON object
   * mapping names to values. See Buckets.
   *
   * Cache-Control policies can be set here on a global level for all the files
   * in the bucket."
   */
  bucketInfo?: Record<string, string> | undefined;

  /**
   * The initial list (a JSON array) of CORS rules for this bucket. See CORS
   * Rules for an overview and the rule structure.
   */
  corsRules?: CorsRules[] | undefined;

  /**
   * If present, the boolean value specifies whether bucket is File
   * Lock-enabled. The default value is false. Setting the value to true
   * requires the writeBucketRetentions capability.
   *
   * @default false
   */
  fileLockEnabled?: boolean | undefined;

  /**
   * The initial list (a JSON array) of lifecycle rules for this bucket.
   * Structure defined below. See Lifecycle Rules.
   */
  lifecycleRules?: LifecycleRule[] | undefined;

  /**
   * The configuration to create a Replication Rule. See Cloud Replication
   * Rules.
   */
  replicationConfiguration?: ReplicationConfiguration | undefined;

  /**
   * The default server-side encryption settings for this bucket. See
   * Server-Side Encryption for an overview and the parameter structure.
   *
   * Setting the value requires the writeBucketEncryption application key
   * capability."
   */
  defaultServerSideEncryption?: object | undefined;
}

interface ReplicationConfiguration {
  asReplicationSource: AsReplicationSource;
}

interface AsReplicationSource {
  replicationRules: ReplicationRule[];
  sourceApplicationKeyId: string;
}

interface ReplicationRule {
  destinationBucketId: string;
  fileNamePrefix: string;
  includeExistingFiles: boolean;
  isEnabled: boolean;
  priority: number;
  replicationRuleName: string;
}

/**
 * Lifecycle rules instruct the B2 service to automatically hide and/or delete
 * old files. You can set up rules to do things like delete old versions of
 * files 30 days after a newer version was uploaded.
 *
 * A bucket can have up to 100 lifecycle rules. Each rule has a fileNamePrefix
 * that specifies which files in the bucket it applies to. Any file whose name
 * starts with the prefix is subject to the rule. A prefix of the empty string,
 * "", means that the rule applies to all files in the bucket.
 *
 * WARNING: This means that a lifecycle rule with fileNamePrefix of the empty
 * string could potentially delete ALL files in a bucket, so please tread
 * carefully.
 *
 * You're not allowed to create two rules that both apply to the same files. For
 * example, a rule with a file name prefix of photos/ and a rule with a file
 * name prefix of photos/kittens/ would both apply to a file named
 * photos/kittens/fluffy.jpg, so you're not allowed to have both rules at the
 * same time.
 *
 * Each lifecycle rule specifies two things: `daysFromUploadingToHiding` and
 * `daysFromHidingToDeleting`. Either can be null, which means that part of the
 * rule doesn't apply. Setting both to null is not allowed, because the rule
 * would do nothing.
 *
 * Setting either `daysFromUploadingToHiding` or `daysFromHidingToDeleting` to 0
 * is not allowed. When either is set, it must be a positive number.
 *
 * The most commonly used setting is `daysFromHidingToDeleting`, which says how
 * long to keep file versions that are not the current version. A file version
 * counts as hidden when explicitly hidden with b2_hide_file, or when a newer
 * file with the same name is uploaded. When a rule with this setting applies,
 * the file will be deleted the given number of days after it is hidden.
 *
 * For example, if you are backing up your files to B2 using the B2 command-line
 * tool, or another software package that uploads files when they change, B2
 * will keep old versions of the file. This is very helpful, because it means
 * the old versions are there if the original file is accidentally deleted. On
 * the other hand, keeping them forever can clutter things up. For an
 * application like this, you might want a lifecycle rule that keeps old
 * versions in the backup/ folder for 30 days, and then deletes them:
 */
interface LifecycleRule {
  /**
   * The most commonly used setting is `daysFromHidingToDeleting`, which says
   * how long to keep file versions that are not the current version. A file
   * version counts as hidden when explicitly hidden with b2_hide_file, or when
   * a newer file with the same name is uploaded. When a rule with this setting
   * applies, the file will be deleted the given number of days after it is
   * hidden.
   *
   * Setting either `daysFromUploadingToHiding` or `daysFromHidingToDeleting` to
   * 0 is not allowed. When either is set, it must be a positive number.
   */
  daysFromHidingToDeleting: number;

  /**
   * Setting either `daysFromUploadingToHiding` or `daysFromHidingToDeleting` to
   * 0 is not allowed. When either is set, it must be a positive number.
   */
  daysFromUploadingToHiding: number;

  /**
   * A bucket can have up to 100 lifecycle rules. Each rule has a fileNamePrefix
   * that specifies which files in the bucket it applies to. Any file whose name
   * starts with the prefix is subject to the rule. A prefix of the empty
   * string, "", means that the rule applies to all files in the bucket.
   *
   * WARNING: This means that a lifecycle rule with fileNamePrefix of the empty
   * string could potentially delete ALL files in a bucket, so please tread
   * carefully.
   */
  fileNamePrefix: string;
}

interface CorsRules {
  /**
   * A name for humans to recognize the rule in a user interface. Names must be
   * unique within a bucket. Names can consist of upper-case and lower-case
   * English letters, numbers, and "-". No other characters are allowed. A name
   * must be at least 6 characters long, and can be at most 50 characters long.
   * These are all allowed names: myPhotosSite, allowAnyHttps, backblaze-images.
   * Names that start with "b2-" are reserved for Backblaze use.
   */
  corsRuleName: string;
  /**
   * A non-empty list specifying which origins the rule covers. Each value may
   * have one of many formats:
   *
   * The origin can be fully specified, such as http://www.example.com:8180 or
   * https://www.example.com:4433.
   *
   * The origin can omit a default port, such as https://www.example.com.
   *
   * The origin may have a single '*' as part of the domain name, such as
   * https://*.example.com, https://*:8443 or https://*.
   *
   * The origin may be 'https' to match any origin that uses HTTPS. (This is
   * broader than 'https://*' because it matches any port.)
   *
   * Finally, the origin can be a single '*' to match any origin.
   *
   * If any entry is "*", it must be the only entry. There can be at most one
   * "https" entry and no entry after it may start with "https:".
   */
  allowedOrigins: string[];
  /**
   * A list specifying which operations the rule allows. At least one value must
   * be specified. All values must be from the following list. More values may
   * be added to this list at any time.
   *
   * B2 Native API Operations:
   * - `b2_download_file_by_name`
   * - `b2_download_file_by_id`
   * - `b2_upload_file`
   * - `b2_upload_part`
   *
   * S3 Compatible Operations, one for each supported HTTP method, mapping to
   * the AllowedMethod element in S3’s CORSRule object.
   * - `s3_delete`
   * - `s3_get`
   * - `s3_head`
   * - `s3_post`
   * - `s3_put`
   */
  allowedHeaders: string[];
  /**
   * If present, this is a list of headers that are allowed in a pre-flight
   * OPTIONS's request's Access-Control-Request-Headers header value. Each value
   * may have one of many formats:
   *
   * - It may be a complete header name, such as x-bz-content-sha1.
   * - It may end with an asterisk, such as x-bz-info-*.
   * - Finally, it may be a single '*' to match any header.
   *
   * If any entry is "*", it must be the only entry in the list. If this list is
   * missing, it is treated as if it is a list with no entries.
   */
  allowedOperations?: string[] | undefined;
  /**
   * If present, this is a list of headers that may be exposed to an application
   * inside the client (eg. exposed to Javascript in a browser). Each entry in
   * the list must be a complete header name (eg. "x-bz-content-sha1"). If this
   * list is missing or empty, no headers will be exposed.
   */
  exposeHeaders: string[];
  /**
   * This specifies the maximum number of seconds that a browser may cache the
   * response to a preflight request. The value must not be negative and it must
   * not be more than 86,400 seconds (one day).
   */
  maxAgeSeconds: number;
}

interface ListFileNameProps {
  /**
   * The bucket to look for file names in. Returned by b2_list_buckets.
   */
  bucketId: string;

  /**
   * The first file name to return. If there is a file with this name, it will
   * be returned in the list. If not, the first file name after this the first
   * one after this name.
   */
  startFileName?: string | undefined;

  /**
   * The maximum number of files to return from this call. The default value is
   * 100, and the maximum is 10000. Passing in 0 means to use the default of
   * 100.
   *
   * NOTE: b2_list_file_names is a Class C transaction (see Pricing). The
   * maximum number of files returned per transaction is 1000. If you set
   * maxFileCount to more than 1000 and more than 1000 are returned, the call
   * will be billed as multiple transactions, as if you had made requests in a
   * loop asking for 1000 at a time. For example: if you set maxFileCount to
   * 10000 and 3123 items are returned, you will be billed for 4 Class C
   * transactions."
   */
  maxFileCount?: number | undefined;

  /**
   * Files returned will be limited to those with the given prefix. Defaults to
   * the empty string, which matches all files.
   */
  prefix?: string | undefined;

  /**
   * Files returned will be limited to those within the top folder, or any one
   * subfolder. Defaults to NULL. Folder names will also be returned. The
   * delimiter character will be used to "break" file names into folders.
   */
  delimiter?: string | undefined;
}

interface ListFileNameData {
  /**
   * An array of objects, each one describing one file or folder. (See below.)
   */
  files: FileData[];
  /**
   * What to pass in to startFileName for the next search to continue where this
   * one left off, or null if there are no more files. Note this this may not be
   * the name of an actual file, but using it is guaranteed to find the next
   * file in the bucket.
   */
  nextFileName: string;
}

interface UploadFileProps extends Omit<GetUploadUrlData, "bucketId"> {
  /**
   * The name of the file, in percent-encoded UTF-8. For example, spaces should
   * be replaced with %20. For more information, see
   * [Files](https://www.backblaze.com/b2/docs/files.html) for requirements on
   * file names and String Encoding for how to encode strings.
   */
  fileName: string;
  /**
   * The MIME type of the content of the file, which will be returned in the
   * Content-Type header when downloading the file. Use the Content-Type
   * b2/x-auto to automatically set the stored Content-Type post upload. In the
   * case where a file extension is absent or the lookup fails, the Content-Type
   * is set to application/octet-stream. The Content-Type mappings can be
   * perused here.
   */
  contentType: string;

  /**
   * The number of bytes in the file being uploaded. Note that this header is
   * required; you cannot leave it out and just use chunked encoding. When
   * sending the SHA1 checksum at the end, the Content-Length should be set to
   * the size of the file plus the 40 bytes of hex checksum.
   */
  contentLength: number;

  /**
   * The SHA1 checksum of the content of the file. B2 will check this when the
   * file is uploaded, to make sure that the file arrived correctly. It will be
   * returned in the X-Bz-Content-Sha1 header when the file is downloaded.
   *
   * You may optionally provide the SHA1 at the end of the upload. See the
   * section on Uploading.
   */
  sha1?: string | undefined;

  /**
   * If the original source of the file being uploaded has a last modified time
   * concept, Backblaze recommends using this spelling of one of your
   * X-Bz-Info-* headers (see below). Using a standard spelling allows different
   * B2 clients and the B2 web user interface to interoperate correctly. The
   * value should be a base 10 number which represents a UTC time when the
   * original source file was last modified. It is a base 10 number of
   * milliseconds since midnight, January 1, 1970 UTC. This fits in a 64 bit
   * integer such as the type "long" in the programming language Java. It is
   * intended to be compatible with Java's time long. For example, it can be
   * passed directly into the Java call Date.setTime(long time).
   */
  lastModified?: string | undefined;

  /**
   * If this is present, B2 will use it as the value of the
   * 'Content-Disposition' header when the file is downloaded (unless it's
   * overridden by a value given in the download request). The value must match
   * the grammar specified in RFC 6266. Parameter continuations are not
   * supported. 'Extended-value's are supported for charset 'UTF-8'
   * (case-insensitive) when the language is empty. Note that this file info
   * will not be included in downloads as a x-bz-info-b2-content-disposition
   * header. Instead, it (or the value specified in a request) will be in the
   * Content-Disposition.
   */
  contentDisposition?: string | undefined;

  /**
   * If this is present, B2 will use it as the value of the 'Content-Language'
   * header when the file is downloaded (unless it's overridden by a value given
   * in the download request). The value must match the grammar specified in RFC
   * 2616. Note that this file info will not be included in downloads as a
   *       x-bz-info-b2-content-language header. Instead, it (or the value
   *       specified in a request) will be in the Content-Language header.
   */
  contentLanguage?: string | undefined;

  /**
   * If this is present, B2 will use it as the value of the 'Expires' header
   * when the file is downloaded (unless it's overridden by a value given in the
   * download request). The value must match the grammar specified in RFC 2616.
   * Note that this file info will not be included in downloads as a
   * x-bz-info-b2-expires header. Instead, it (or the value specified in a
   * request) will be in the Expires header.
   */
  expires?: string | undefined;

  /**
   * If this is present, B2 will use it as the value of the 'Cache-Control'
   * header when the file is downloaded (unless it's overridden by a value given
   * in the download request), and overriding the value defined at the bucket
   * level. The value must match the grammar specified in RFC 2616. Note that
   * this file info will not be included in downloads as a
   * x-bz-info-cache-control header. Instead, it (or the value specified in a
   * request) will be in the Cache-Control header.
   */
  cacheControl?: string | undefined;

  /**
   * If this is present, B2 will use it as the value of the 'Content-Encoding'
   * header when the file is downloaded (unless it's overridden by a value given
   * in the download request). The value must match the grammar specified in RFC
   * 2616. Note that this file info will not be included in downloads as a
   *       x-bz-info-b2-content-encoding header. Instead, it (or the value
   *       specified in a request) will be in the Content-Encoding header.
   */
  contentEncoding?: string | undefined;

  /**
   * The * part of the header name is replaced with the name of a custom field
   * in the file information stored with the file, and the value is an arbitrary
   * UTF-8 string, percent-encoded. The same info headers sent with the upload
   * will be returned with the download. The header name is case insensitive.
   */
  info?: string | undefined;

  /**
   * If this is present, specifies the File Lock legal hold status for the file.
   * Valid values for this header are on and off. Setting the value requires the
   * writeFileLegalHolds capability and that the bucket is File Lock-enabled.
   */
  fileLegalHold?: string | undefined;

  /**
   * If this is present, specifies the File Lock retention mode for the file.
   * Valid values for this header are governance and compliance. Setting the
   * value requires the writeFileRetentions capability and that the bucket is
   * File Lock-enabled.
   *
   * If this header is present, then a valid `fileRetentionRetainUntilTimestamp`
   * header must be present as well.
   */
  fileRetentionMode?: "governance" | "compliance" | undefined;

  /**
   * If this is present, specifies a File Lock retention timestamp in the
   * future, after which the intended File Lock will expire. This header value
   * must be specified as a base 10 number of milliseconds since midnight,
   * January 1, 1970 UTC. Setting the value requires the writeFileRetentions
   * capability and that the bucket is File Lock-enabled.
   *
   * If this header is present, then a valid `fileRetentionMode` header must be
   * present as well.
   */
  fileRetentionRetainUntilTimestamp?: number | undefined;

  /**
   * If this is present, B2 will encrypt the uploaded data before storing the
   * file using Server-Side Encryption with Backblaze-Managed Keys (SSE-B2) with
   * the algorithm specified in this header. Currently, the only supported value
   * for this header is AES256.
   *
   * This header must not be present if SSE-C headers
   * (`serverSideEncryptionCustomer*`, see below) are included with this
   * request, and vice versa.
   */
  serverSideEncryption?: "AES256" | undefined;

  /**
   * If this is present, B2 will encrypt the uploaded data before storing the
   * file using Server-Side Encryption with Customer-Managed Keys (SSE-C) with
   * the algorithm specified in this header. Currently, the only supported value
   * for this header is `AES256`.
   */
  serverSideEncryptionCustomerAlgorithm?: "AES256" | undefined;

  /**
   * If this is present, it specifies the base64-encoded encryption key for
   * Backblaze B2 to use in encrypting data with Server-Side Encryption with
   * Customer-Managed Keys (SSE-C). The value of the header is used to store the
   * file and then is immediately discarded. The key must be appropriate for use
   * with the algorithm specified in the `serverSideEncryptionCustomerAlgorithm`
   * header.
   */
  serverSideEncryptionCustomerKey?: string | undefined;

  /**
   * If this is present, it specifies the base64-encoded 128-bit MD5 digest of
   * the encryption key to be used with Server-Side Encryption with
   * Customer-Managed Keys (SSE-C). Backblaze B2 uses this header to verify that
   * the encryption key was transmitted correctly.
   */
  serverSideEncryptionCustomerKeyMd5?: string | undefined;
}

type Endpoint = keyof JsonErrorMap;

interface JsonErrorResponse<
  Key extends keyof JsonErrorMap = keyof JsonErrorMap,
> {
  success: false;
  error: JsonErrorMap[Key];
}
interface JsonSuccessResponse<Data> {
  success: true;
  error?: never | undefined;
  data: Data;
}

type JsonResponse<Data, Key extends keyof JsonErrorMap = keyof JsonErrorMap> =
  | JsonErrorResponse<Key>
  | JsonSuccessResponse<Data>;

interface GetUploadUrlData {
  /**
   * The unique ID of the bucket.
   */
  bucketId: string;
  /**
   * The URL that can be used to upload files to this bucket, see
   * b2_upload_file.
   */
  uploadUrl: string;
  /**
   * The authorizationToken that must be used when uploading files to this
   * bucket. This token is valid for 24 hours or until the uploadUrl endpoint
   * rejects an upload, see b2_upload_file
   */
  authorizationToken: string;
}

interface CancelLargeFileData {
  /**
   * The ID of the file whose upload that was canceled.
   */
  fileId: string;

  /**
   * The account that the bucket is in.
   */
  accountId: string;

  /**
   * The unique ID of the bucket.
   */
  bucketId: string;

  /**
   * The name of the file that was canceled.
   */
  fileName: string;
}

interface FileRetention {
  isClientAuthorizedToRead: boolean;
  value: "off" | {
    mode: "governance" | "compliance" | null;
    retainUntilTimestamp: number | null;
  } | null;
}

interface FileData {
  /**
   * The account that owns the file.
   */
  accountId: string;
  /**
   * One of "start", "upload", "hide", "folder", or other values added in the
   * future. "upload" means a file that was uploaded to B2 Cloud Storage.
   * "start" means that a large file has been started, but not finished or
   * canceled. "hide" means a file version marking the file as hidden, so that
   * it will not show up in b2_list_file_names. "folder" is used to indicate a
   * virtual folder when listing files.
   */
  action: "start" | "upload" | "hide" | "folder";
  /**
   * The bucket that the file is in.
   */
  bucketId: string;
  /**
   * The number of bytes stored in the file. Only useful when the action is
   * "upload". Always 0 when the action is "start", "hide", or "folder".
   */
  contentLength: number;
  /**
   * The SHA1 of the bytes stored in the file as a 40-digit hex string. Large
   * files do not have SHA1 checksums, and the value is "none". The value is
   * null when the action is "hide" or "folder".
   */
  contentSha1: string;

  /**
   * The MD5 of the bytes stored in the file as a 32-digit hex string. Not all
   * files have an MD5 checksum, so this field is optional, and set to null for
   * files that do not have one. Large files do not have MD5 checksums, and the
   * value is null. The value is also null when the action is "hide" or
   * "folder".
   */
  contentMd5?: string | undefined;
  /**
   * When the action is "upload" or "start", the MIME type of the file, as
   * specified when the file was uploaded. For "hide" action, always
   * "application/x-bz-hide-marker". For "folder" action, always null.
   */
  contentType: string;
  /**
   * The unique identifier for this version of this file. Used with
   * b2_get_file_info, b2_download_file_by_id, and b2_delete_file_version. The
   * value is null when for action "folder".
   */
  fileId: string;
  /**
   * The custom information that was uploaded with the file. This is a JSON
   * object, holding the name/value pairs that were uploaded with the file.
   */
  fileInfo: {
    src_last_modified_millis: string;
  };
  /**
   * The name of this file, which can be used with b2_download_file_by_name.
   */
  fileName: string;
  /**
   * The File Lock retention settings for this file, if any.
   *
   * This field is filtered based on application key capabilities; the
   * readFileRetentions capability is required to access the value. See File
   * Lock for more details on response structure.
   *
   * This field is omitted when the action is ""hide"" or ""folder""."
   */
  fileRetention: FileRetention;
  /**
   * The File Lock legal hold status for this file, if any.
   *
   * This field is omitted when the action is ""hide"" or ""folder""."
   *
   * This field is filtered based on application key capabilities; the
   * readFileLegalHolds capability is required to access the value. See File
   * Lock for more details on response structure.
   */
  legalHold: {
    isClientAuthorizedToRead: boolean;
    value: string | null;
  };
  /**
   * The Replication Status for this file, if any. This will show either
   * PENDING, COMPLETED, FAILED, or REPLICA. For details see Cloud Replication
   *
   * This field is omitted when the file is not part of a replication rule."
   */
  replicationStatus: string;
  /**
   * "When the file is encrypted with Server-Side Encryption, the mode
   * (""SSE-B2"" or ""SSE-C"") and algorithm used to encrypt the data. If the
   * file is not encrypted with Server-Side Encryption, then both mode and
   * algorithm will be null.
   *
   * This field is omitted when the action is ""hide"" or ""folder""."
   */
  serverSideEncryption: {
    algorithm: "AES256";
    mode: "SSE-B2" | "SSE-C";
  };
  /**
   * "This is a UTC time when this file was uploaded. It is a base 10 number of
   * milliseconds since midnight, January 1, 1970 UTC. This fits in a 64 bit
   * integer such as the type ""long"" in the programming language Java. It is
   * intended to be compatible with Java's time long. For example, it can be
   * passed directly into the java call Date.setTime(long time).
   *
   * Always 0 when the action is ""folder""."
   */
  uploadTimestamp: number;
}

interface AuthorizeData {
  /**
   * The identifier for the account.
   */
  accountId: string;

  /**
   * An authorization token to use with all calls, other than
   * b2_authorize_account, that need an Authorization header. This authorization
   * token is valid for at most 24 hours.
   */
  authorizationToken: string;

  /**
   * An object (see below) containing the capabilities of this auth token, and
   * any restrictions on using it.
   */
  allowed: Allowed;

  /**
   * The base URL to use for all API calls except for uploading and downloading
   * files.
   */
  apiUrl: string;

  /**
   * The base URL to use for downloading files.
   */
  downloadUrl: string;

  /**
   * The recommended size for each part of a large file. We recommend using this
   * part size for optimal upload performance.
   */
  recommendedPartSize: string;

  /**
   * The smallest possible size of a part of a large file (except the last one).
   * This is smaller than the recommendedPartSize. If you use it, you may find
   * that it takes longer overall to upload a large file.
   */
  absoluteMinimumPartSize: string;

  /**
   * @deprecated This field will always have the same value as
   * recommendedPartSize. Use recommendedPartSize instead.
   */
  minimumPartSize: string;

  /**
   * The base URL to use for all API calls using the S3 compatible API.
   */
  s3ApiUrl: string;
}

interface Allowed {
  /**
   * A list of strings, each one naming a capability the key has. Possibilities
   * are: listKeys, writeKeys, deleteKeys, listBuckets, writeBuckets,
   * deleteBuckets, listFiles, readFiles, shareFiles, writeFiles, and
   * deleteFiles.
   */
  capabilities: Capability[];

  /**
   * When present, access is restricted to one bucket.
   */
  bucketId?: string | undefined;

  /**
   * When bucketId is set, and it is a valid bucket that has not been deleted,
   * this field is set to the name of the bucket. It's possible that bucketId is
   * set to a bucket that no longer exists, in which case this field will be
   * null. It's also null when bucketId is null.
   */
  bucketName?: string | undefined;

  /**
   * When present, access is restricted to files whose names start with the
   * prefix
   */
  namePrefix?: string | undefined;
}

export type Capability =
  | "listKeys"
  | "writeKeys"
  | "deleteKeys"
  | "listBuckets"
  | "writeBuckets"
  | "deleteBuckets"
  | "listFiles"
  | "readFiles"
  | "shareFiles"
  | "writeFiles"
  | "deleteFiles"
  | "writeBucketRetentions"
  | "writeBucketEncryption";

export enum ErrorCode {
  /**
   * There is a problem with a passed in request parameters - the JSON error
   * structure returned will contain an error code of bad_request and a
   * human-readable error message describing the problem.
   */
  "BAD REQUEST" = 400,

  /**
   * When calling b2_authorize_account, this means that there was something
   * wrong with the applicationKeyId or with the application key that was
   * provided. The code unauthorized means that the application key is bad. The
   * code unsupported means that the application key is only valid in a later
   * version of the API.
   *
   * When uploading data using b2_upload_file or b2_upload_part, this can mean a
   * variety of things. Try calling b2_get_upload_url or b2_get_upload_part_url
   * again to get a new upload target and auth token. That call will either work
   * or provide a meaningful error code.
   *
   * For all other API calls, the code returned tells you what to do. The code
   * unauthorized means that the auth token is valid, but does not allow you to
   * make this call with these parameters. When the code is either
   * bad_auth_token or expired_auth_token you should call b2_authorize_account
   * again to get a new auth token.
   */
  "UNAUTHORIZED" = 401,

  /**
   * You have a reached a storage cap limit, or account access may be impacted
   * in some other way; see the human-readable message.
   */
  "FORBIDDEN" = 403,

  /**
   * The service timed out trying to read your request.
   */
  "REQUEST TIMEOUT" = 408,

  /**
   * B2 may limit API requests on a per-account basis.
   */
  "TOO MANY REQUESTS" = 429,

  /**
   * An unexpected error has occurred.
   */
  "INTERNAL ERROR" = 500,

  /**
   * The service is temporarily unavailable. The human-readable message
   * identifies the nature of the issue, in general we recommend retrying with
   * an exponential backoff between retries in response to this error.
   */
  "SERVICE UNAVAILABLE" = 503,
}

interface BaseJsonError {
  code: string;
  status: ErrorCode;
  message: string;
}

/**
 * The requested bucket ID does not match an existing bucket.
 */
interface BadBucketIdError extends BaseJsonError {
  code: `bad_bucket_id`;
  status: 400;
}
/**
 * The request had the wrong fields or illegal values. The message returned with
 * the error will describe the problem.
 *
 * Also: Timed out while iterating and skipping files
 */
interface BadRequestError extends BaseJsonError {
  code: `bad_request`;
  status: 400 | 503;
}
/**
 * A bucket must be empty before it can be deleted. To delete this bucket, first
 * remove all of the files in the bucket, then try the delete operation again.
 */
interface CannotDeleteNonEmptyBucketError extends BaseJsonError {
  code: `cannot_delete_non_empty_bucket`;
  status: 400;
}

/**
 * Invalid bucketId: <bucketId>
 */
interface InvalidBucketIdError extends BaseJsonError {
  code: `invalid_bucket_id`;
  status: 400;
}

/**
 * maxFileCount out of range: <maxFileCount>
 */
interface OutOfRangeError extends BaseJsonError {
  code: `out_of_range`;
  status: 400;
}

/**
 * The auth token used is not valid. Call b2_authorize_account again to either
 * get a new one, or an error message describing the problem.
 */
interface BadAuthTokenError extends BaseJsonError {
  code: `bad_auth_token`;
  status: 401;
}
/**
 * The auth token used has expired. Call b2_authorize_account again to get a new
 * one.
 */
interface ExpiredAuthTokenError extends BaseJsonError {
  code: `expired_auth_token`;
  status: 401;
}
/**
 * The auth token used is valid, but does not authorize this call with these
 * parameters. The capabilities of an auth token are determined by the
 * application key used with b2_authorize_account.
 */
interface UnauthorizedError extends BaseJsonError {
  code: `unauthorized`;
  status: 401;
}

/**
 * The applicationKeyId is valid, but cannot be used with this version of the B2
 * API. The message contains information about what the problem is.
 */
interface UnsupportedError extends BaseJsonError {
  code: `unsupported`;
  status: 401;
}

/**
 * The provided customer-managed encryption key is wrong.
 */
interface AccessDeniedError extends BaseJsonError {
  code: `access_denied`;
  status: 403;
}

interface StorageCapExceededError extends BaseJsonError {
  code: `storage_cap_exceeded`;
  status: 403;
}

/**
 * Transaction cap exceeded. To increase your cap, sign in to your B2 Cloud
 * Storage account online. Then select the Caps & Alerts link in the B2 Cloud
 * Storage section of the sidebar.
 */
interface TransactionCapExceededError extends BaseJsonError {
  code: `transaction_cap_exceeded`;
  status: 403;
}
/**
 * File is not in B2 Cloud Storage.
 */
interface NotFoundError extends BaseJsonError {
  code: `not_found`;
  status: 404;
}
/**
 * Only POST is supported
 */
interface MethodNotAllowedError extends BaseJsonError {
  code: `method_not_allowed`;
  status: 405;
}
/**
 * The service timed out reading the uploaded file
 */
interface RequestTimeoutError extends BaseJsonError {
  code: `request_timeout`;
  status: 408;
}
/**
 * The Range header in the request is valid but cannot be satisfied for the
 * file.
 */
interface RangeNotSatisfiableError extends BaseJsonError {
  code: `range_not_satisfiable`;
  status: 416;
}

interface ServiceUnavailableError extends BaseJsonError {
  code: `range_not_satisfiable`;
  status: 503;
}

interface JsonErrorMap {
  b2_authorize_account:
    | BadBucketIdError
    | BadRequestError
    | CannotDeleteNonEmptyBucketError
    | UnauthorizedError
    | UnsupportedError
    | TransactionCapExceededError;
  b2_cancel_large_file:
    | BadBucketIdError
    | BadRequestError
    | CannotDeleteNonEmptyBucketError
    | BadAuthTokenError
    | ExpiredAuthTokenError
    | UnauthorizedError;
  b2_get_upload_url:
    | BadBucketIdError
    | BadRequestError
    | CannotDeleteNonEmptyBucketError
    | BadAuthTokenError
    | ExpiredAuthTokenError
    | UnauthorizedError
    | StorageCapExceededError
    | ServiceUnavailableError;
  b2_upload_file:
    | BadBucketIdError
    | BadRequestError
    | CannotDeleteNonEmptyBucketError
    | BadAuthTokenError
    | ExpiredAuthTokenError
    | UnauthorizedError
    | StorageCapExceededError
    | ServiceUnavailableError
    | MethodNotAllowedError
    | RequestTimeoutError;
  b2_list_file_names:
    | BadBucketIdError
    | BadRequestError
    | CannotDeleteNonEmptyBucketError
    | InvalidBucketIdError
    | OutOfRangeError
    | TransactionCapExceededError
    | BadAuthTokenError
    | ExpiredAuthTokenError
    | UnauthorizedError;
  b2_copy_file: BaseJsonError;
  b2_copy_part: BaseJsonError;
  b2_create_bucket: BaseJsonError;
  b2_create_key: BaseJsonError;
  b2_delete_bucket: BaseJsonError;
  b2_delete_file_version: BaseJsonError;
  b2_delete_key: BaseJsonError;
  b2_download_file_by_id: BaseJsonError;
  b2_download_file_by_name: BaseJsonError;
  b2_finish_large_file: BaseJsonError;
  b2_get_download_authorization: BaseJsonError;
  b2_get_file_info: BaseJsonError;
  b2_get_upload_part_url: BaseJsonError;
  b2_hide_file: BaseJsonError;
  b2_list_buckets: BaseJsonError;
  b2_list_file_versions: BaseJsonError;
  b2_list_keys: BaseJsonError;
  b2_list_parts: BaseJsonError;
  b2_list_unfinished_large_files: BaseJsonError;
  b2_start_large_file: BaseJsonError;
  b2_update_bucket: BaseJsonError;
  b2_update_file_legal_hold: BaseJsonError;
  b2_update_file_retention: BaseJsonError;
  b2_upload_part: BaseJsonError;
}
