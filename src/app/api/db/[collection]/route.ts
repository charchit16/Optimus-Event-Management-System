import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import {
  defaultProfiles,
  defaultOrganizations,
  defaultEvents,
  defaultFormFields,
  defaultPosts,
  defaultRegistrations,
} from "@/lib/defaultSeedData";

// Helper to build flexible ID conditions (handles string id, string _id, and ObjectId)
function buildIdFilter(idVal: any): any[] | null {
  if (!idVal) return null;
  const conditions: any[] = [{ id: idVal }, { _id: idVal }];
  if (typeof idVal === "string" && ObjectId.isValid(idVal)) {
    try {
      conditions.push({ _id: new ObjectId(idVal) });
    } catch {}
  }
  return conditions;
}

// Helper to normalize docs so 'id' is always present
function normalizeDoc(doc: any): any {
  if (!doc) return null;
  const item: any = { ...doc };
  if (!item.id && item._id) {
    item.id = item._id.toString();
  }
  return item;
}

// Helper to seed initial collection if empty
async function ensureSeedData(collectionName: string) {
  try {
    const db = await getDb();
    const count = await db.collection(collectionName).countDocuments();
    if (count > 0) return;

    if (collectionName === "profiles") {
      await db.collection("profiles").insertMany(defaultProfiles);
    } else if (collectionName === "organizations") {
      await db.collection("organizations").insertMany(defaultOrganizations);
    } else if (collectionName === "events") {
      await db.collection("events").insertMany(defaultEvents);
    } else if (collectionName === "event_form_fields") {
      await db.collection("event_form_fields").insertMany(defaultFormFields);
    } else if (collectionName === "posts") {
      await db.collection("posts").insertMany(defaultPosts);
    } else if (collectionName === "event_registrations") {
      await db.collection("event_registrations").insertMany(defaultRegistrations);
    }
  } catch (err) {
    console.error(`Auto-seed error for ${collectionName}:`, err);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;

  try {
    const db = await getDb();
    await ensureSeedData(collection);

    const { searchParams } = new URL(request.url);
    const filterParam = searchParams.get("filter");
    const sortField = searchParams.get("sort");
    const sortOrder = searchParams.get("order") === "asc" ? 1 : -1;
    const limitParam = searchParams.get("limit");
    const isSingle = searchParams.get("single") === "true";
    const wantCount = searchParams.get("count") === "exact";
    const selectParam = searchParams.get("select");

    let mongoFilter: any = {};
    if (filterParam) {
      try {
        mongoFilter = JSON.parse(filterParam);
      } catch {
        mongoFilter = {};
      }
    }

    // Convert id and _id queries
    if (mongoFilter.id) {
      const orConditions = buildIdFilter(mongoFilter.id);
      if (orConditions) mongoFilter.$or = orConditions;
      delete mongoFilter.id;
    }
    if (mongoFilter._id) {
      const orConditions = buildIdFilter(mongoFilter._id);
      if (orConditions) mongoFilter.$or = orConditions;
      delete mongoFilter._id;
    }
    if (mongoFilter.status && typeof mongoFilter.status === "string") {
      mongoFilter.status = { $regex: new RegExp(`^${mongoFilter.status}$`, "i") };
    }

    const coll = db.collection(collection);

    if (wantCount && searchParams.get("head") === "true") {
      const count = await coll.countDocuments(mongoFilter);
      return NextResponse.json({ data: null, count, error: null });
    }

    let cursor = coll.find(mongoFilter);

    if (sortField) {
      cursor = cursor.sort({ [sortField]: sortOrder });
    }

    if (limitParam) {
      const l = parseInt(limitParam, 10);
      if (!isNaN(l) && l > 0) cursor = cursor.limit(l);
    }

    const docs = await cursor.toArray();

    // Map docs to ensure `id` is always available and normalize relations
    const formatted = await Promise.all(
      docs.map(async (doc: any) => {
        const item: any = normalizeDoc(doc);

        // Automatic lookups for relational mock compatibility
        if (collection === "event_registrations") {
          if (!item.events && item.event_id) {
            const ev = await db.collection("events").findOne({
              $or: buildIdFilter(item.event_id) || [{ id: item.event_id }],
            });
            if (ev) item.events = normalizeDoc(ev);
          }
          if (!item.profiles && item.user_id) {
            const prof = await db.collection("profiles").findOne({
              $or: [{ uuid: item.user_id }, { id: item.user_id }],
            });
            if (prof) item.profiles = normalizeDoc(prof);
          }
        }

        if (collection === "profiles" && !item.organizations && item.organisation_id) {
          const org = await db.collection("organizations").findOne({
            $or: buildIdFilter(item.organisation_id) || [{ id: item.organisation_id }],
          });
          if (org) item.organizations = normalizeDoc(org);
        }

        return item;
      })
    );

    if (isSingle) {
      const singleDoc = formatted.length > 0 ? formatted[0] : null;
      return NextResponse.json({ data: singleDoc, error: null, count: formatted.length });
    }

    return NextResponse.json({ data: formatted, error: null, count: formatted.length });
  } catch (error: any) {
    console.error(`MongoDB GET error on ${collection}:`, error);
    const msg = error?.message || String(error) || "Database query failed";
    return NextResponse.json({ data: null, error: { message: msg } }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;

  try {
    const db = await getDb();
    const body = await request.json();
    const coll = db.collection(collection);

    const isArray = Array.isArray(body);
    const items = isArray ? body : [body];

    const prepared = items.map((item: any) => {
      const copy = { ...item };
      delete copy._id; // Ensure client cannot pass empty or duplicate _id
      const id = copy.id || crypto.randomUUID();
      return {
        ...copy,
        id,
        created_at: copy.created_at || new Date().toISOString(),
      };
    });

    await coll.insertMany(prepared);

    const result = isArray ? prepared : prepared[0];
    return NextResponse.json({ data: result, error: null });
  } catch (error: any) {
    console.error(`MongoDB POST error on ${collection}:`, error);
    const msg = error?.message || String(error) || "Database insert failed";
    return NextResponse.json({ data: null, error: { message: msg } }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;

  try {
    const db = await getDb();
    const body = await request.json();
    const { filter = {}, update = {} } = body;

    const mongoFilter: any = { ...filter };
    if (mongoFilter.id) {
      const orConditions = buildIdFilter(mongoFilter.id);
      if (orConditions) mongoFilter.$or = orConditions;
      delete mongoFilter.id;
    }
    if (mongoFilter._id) {
      const orConditions = buildIdFilter(mongoFilter._id);
      if (orConditions) mongoFilter.$or = orConditions;
      delete mongoFilter._id;
    }

    // CRITICAL FIX: Delete immutable _id from $set payload
    const updatePayload = { ...update };
    delete updatePayload._id;

    const coll = db.collection(collection);
    await coll.updateMany(mongoFilter, { $set: updatePayload });

    const updated = await coll.find(mongoFilter).toArray();
    const formatted = updated.map((doc: any) => normalizeDoc(doc));
    return NextResponse.json({ data: formatted, error: null });
  } catch (error: any) {
    console.error(`MongoDB PATCH error on ${collection}:`, error);
    const msg = error?.message || String(error) || "Database update failed";
    return NextResponse.json({ data: null, error: { message: msg } }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const filterParam = searchParams.get("filter");

    let mongoFilter: any = {};
    if (filterParam) {
      try {
        mongoFilter = JSON.parse(filterParam);
      } catch {
        mongoFilter = {};
      }
    }

    if (mongoFilter.id) {
      const orConditions = buildIdFilter(mongoFilter.id);
      if (orConditions) mongoFilter.$or = orConditions;
      delete mongoFilter.id;
    }
    if (mongoFilter._id) {
      const orConditions = buildIdFilter(mongoFilter._id);
      if (orConditions) mongoFilter.$or = orConditions;
      delete mongoFilter._id;
    }

    const coll = db.collection(collection);
    await coll.deleteMany(mongoFilter);

    return NextResponse.json({ data: null, error: null });
  } catch (error: any) {
    console.error(`MongoDB DELETE error on ${collection}:`, error);
    const msg = error?.message || String(error) || "Database delete failed";
    return NextResponse.json({ data: null, error: { message: msg } }, { status: 500 });
  }
}
