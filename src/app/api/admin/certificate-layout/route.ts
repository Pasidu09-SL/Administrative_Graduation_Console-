import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export interface CertificateLayoutData {
  // Front Page Settings
  studentNameY: number;
  studentNameFontSize: number;
  degreeNameY: number;
  degreeNameFontSize: number;
  dateDigitalText: string;
  dateDigitalY: number;
  dateVerbalText: string;
  dateVerbalY: number;

  // Back Page Settings
  titleY: number;
  preambleY: number;
  preambleSiInternal: string;
  preambleSiExternal: string;
  preambleTaInternal: string;
  preambleTaExternal: string;
  suffixSi: string;
  suffixTa: string;
  dateSiLine1: string;
  dateSiLine2: string;
  dateTaLine1: string;
  dateTaLine2: string;
  registrarName: string;
  registrarTitle: string;
  vcName: string;
  vcTitle: string;
  registrarX: number;
  vcX: number;
  signatureY: number;
}

export const DEFAULT_LAYOUT: CertificateLayoutData = {
  studentNameY: 490,
  studentNameFontSize: 26,
  degreeNameY: 405,
  degreeNameFontSize: 20,
  dateDigitalText: '15th January 2023',
  dateDigitalY: 350,
  dateVerbalText: 'Twenty Seventh Day of July in the Year Two Thousand Twenty Three',
  dateVerbalY: 245,

  titleY: 500,
  preambleY: 482,
  preambleSiInternal: 'මෙම විශ්වවිද්‍යාලයේ අභ්‍යන්තර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත',
  preambleSiExternal: 'මෙම විශ්වවිද්‍යාලයේ බාහිර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත',
  preambleTaInternal: 'இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட உள்வாரி கற்கை\nநெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக\nநிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்\nமறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு',
  preambleTaExternal: 'இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட வெளிவாரி கற்கை\nநெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக\nநிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்\nமறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு',
  suffixSi: 'පිරිනමන ලද බව මෙයින් සහතික කරමු.',
  suffixTa: 'வழங்கப்பட்டதென இத்தால்\nஉறுதிப்படுத்துகின்றோம்.',
  dateSiLine1: 'වලංගු වීමේ දිනය: 15/01/2023',
  dateSiLine2: 'උපාධි ප්‍රදානෝත්සවය: 2023 ජූලි මස 27',
  dateTaLine1: 'செல்லுபடியாகும் திகதி: 15/01/2023',
  dateTaLine2: 'பட்டமளிப்பு விழா: 27 ஜூலை 2023',
  registrarName: 'එස්.සී. හේරත් / எஸ்.சி.ஹேரத்',
  registrarTitle: 'ලේඛකාධිකාරි / பதிவாளர்',
  vcName: 'වෛද්‍ය පී.එච්.ජේ. පුෂ්පකුමාර / வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார',
  vcTitle: 'වැඩ බලන උපකුලපති / பதில் உபவேந்தர்',
  registrarX: 99.213,
  vcX: 496.063,
  signatureY: 118,
};

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const convocationYear = searchParams.get('convocation_year');
    if (!convocationYear) {
      return NextResponse.json({ success: false, error: 'convocation_year is required' }, { status: 400 });
    }

    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        'SELECT layout_data FROM certificate_layouts WHERE convocation_year = $1',
        [convocationYear]
      );
      if (res.rows.length === 0) {
        return DEFAULT_LAYOUT;
      }
      return { ...DEFAULT_LAYOUT, ...res.rows[0].layout_data };
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { convocation_year, layout_data } = body;

    if (!convocation_year || !layout_data) {
      return NextResponse.json({ success: false, error: 'convocation_year and layout_data are required' }, { status: 400 });
    }

    // Filter layout data to match layout format
    const filteredLayout: any = {};
    for (const key of Object.keys(DEFAULT_LAYOUT)) {
      if (layout_data[key] !== undefined) {
        filteredLayout[key] = layout_data[key];
      } else {
        filteredLayout[key] = (DEFAULT_LAYOUT as any)[key];
      }
    }

    await runAsAdmin(async (client) => {
      // Upsert Layout data
      await client.query(
        `INSERT INTO certificate_layouts (convocation_year, layout_data, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (convocation_year) 
         DO UPDATE SET layout_data = EXCLUDED.layout_data, updated_at = CURRENT_TIMESTAMP`,
        [convocation_year, JSON.stringify(filteredLayout)]
      );

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken, student_id)
         VALUES ($1, $2, NULL)`,
        [session.username, `Updated certificate layout configuration for convocation year ${convocation_year}`]
      );
    });

    return NextResponse.json({ success: true, data: filteredLayout });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
