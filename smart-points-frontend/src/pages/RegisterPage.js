
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import EmailVerification from '../components/EmailVerification';

const BARANGAYS = [
  'Alang-Alang', 'Bakilid', 'Banilad', 'Basak',
  'Cabancalan', 'Cambaro', 'Canduman', 'Casili',
  'Casuntingan', 'Centro', 'Cubacub', 'Guizo',
  'Ibabao-Estancia', 'Jagobiao', 'Labogon',
  'Looc', 'Maguikay', 'Mantuyong', 'Opao',
  'Pagsabungan', 'Paknaan', 'Subangdaku',
  'Tabok', 'Tawason', 'Tingub', 'Tipolo',
  'Umapad'
];

const ID_TYPES = [
  { value: 'national_id', label: 'Philippine National ID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voters_id', label: "Voter's ID" },
  { value: 'senior_citizen_id', label: 'Senior Citizen ID' },
  { value: 'other', label: 'Others' }
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf'
];

function RegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
const [verificationEmailSent, setVerificationEmailSent] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    date_of_birth: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    city: 'Mandaue City',
    barangay: '',
    address: '',
    role: 'community_member',
    partner_name: '',
    business_permit_number: '',
    business_address: '',
    business_barangay: '',
  representative_id_type: '',
id_type: '',
id_number: '',
other_id_type: '',

// LGU registration information
lgu_level: '',
lgu_office: '',
lgu_other_office: '',
lgu_barangay: '',
lgu_office_address: '',
lgu_office_contact: '',
lgu_designation: '',
lgu_authorization: false,

residency_declaration: false,
privacy_acknowledgment: false
  });

  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);

  const [businessPermit, setBusinessPermit] = useState(null);
  const [storefrontPhoto, setStorefrontPhoto] = useState(null);
  const [representativeId, setRepresentativeId] = useState(null);
 // LGU verification documents
const [lguLOI, setLguLOI] = useState(null);
const [lguId, setLguId] = useState(null);

  // =====================================================
  // CAMERA STATES AND REFERENCES
  // =====================================================

  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraSideRef = useRef(null);

  const [cameraSide, setCameraSide] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [frontPreview, setFrontPreview] = useState('');
  const [backPreview, setBackPreview] = useState('');

const isCitizen = form.role === 'community_member';
const isPartner = form.role === 'partner';
const isLGU = form.role === 'lgu';

  // =====================================================
  // FILE PREVIEWS
  // =====================================================

  useEffect(() => {
    if (!idFront || !idFront.type.startsWith('image/')) {
      setFrontPreview('');
      return;
    }

    const url = URL.createObjectURL(idFront);
    setFrontPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [idFront]);

  useEffect(() => {
    if (!idBack || !idBack.type.startsWith('image/')) {
      setBackPreview('');
      return;
    }

    const url = URL.createObjectURL(idBack);
    setBackPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [idBack]);

  // =====================================================
  // OPEN REAL CAMERA
  // =====================================================

  useEffect(() => {
    if (!cameraSide) return undefined;

    let cancelled = false;

    setCameraLoading(true);
    setCameraError('');

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            'Camera access requires HTTPS or localhost and a supported browser.'
          );
        }

        let stream;

        try {
         stream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    facingMode: { ideal: 'environment' }
  }
});
        } catch (firstError) {
          if (
            firstError.name === 'NotFoundError' ||
            firstError.name === 'OverconstrainedError'
          ) {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: true
            });
          } else {
            throw firstError;
          }
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          await videoRef.current.play().catch(() => {});
        }
      } catch (error) {
        if (!cancelled) {
          const denied =
            error.name === 'NotAllowedError' ||
            error.name === 'PermissionDeniedError';

          setCameraError(
            denied
              ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
              : error.message ||
                'Could not open a camera. Check that a webcam is connected.'
          );
        }
      } finally {
        if (!cancelled) {
          setCameraLoading(false);
        }
      }
    };

    startCamera();

    const videoElement = videoRef.current;

    return () => {
      cancelled = true;

      if (cameraStreamRef.current) {
        cameraStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        cameraStreamRef.current = null;
      }

      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [cameraSide]);

  const openCamera = (side) => {
    setMessage('');
    setCameraError('');
    cameraSideRef.current = side;
    setCameraSide(side);
  };

  const closeCamera = () => {
    cameraSideRef.current = null;
    setCameraSide(null);
  };



  
  // Check photo sharpness using the variance of a Laplacian filter.
  // This is a heuristic, not a guarantee that all ID text is readable.
  const checkImageBlur = (canvas) => {
    const sample = document.createElement('canvas');
    sample.width = 320;
    sample.height = Math.max(
      1,
      Math.round((canvas.height / canvas.width) * 320)
    );

    const ctx = sample.getContext('2d', {
      willReadFrequently: true
    });

    ctx.drawImage(
      canvas,
      0,
      0,
      sample.width,
      sample.height
    );

    const { data } = ctx.getImageData(
      0,
      0,
      sample.width,
      sample.height
    );

    const width = sample.width;
    const height = sample.height;
    const gray = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const index = i * 4;

      gray[i] =
        data[index] * 0.299 +
        data[index + 1] * 0.587 +
        data[index + 2] * 0.114;
    }

    let sum = 0;
    let sumSquares = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;

        const laplacian =
          gray[i - width] +
          gray[i + width] +
          gray[i - 1] +
          gray[i + 1] -
          4 * gray[i];

        sum += laplacian;
        sumSquares += laplacian * laplacian;
        count++;
      }
    }

    const mean = sum / count;
    const variance = sumSquares / count - mean * mean;

    return {
      score: variance,
      isBlurry: variance < 40
    };
  };

  // =====================================================
  // CAPTURE PHOTO
  // =====================================================

   
  const capturePhoto = () => {
    const video = videoRef.current;
    const side = cameraSideRef.current;

    if (
      !side ||
      !video ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setCameraError(
        'Camera is not ready. Please wait.'
      );
      return;
    }

    const canvas = document.createElement('canvas');

    const context = canvas.getContext('2d');

if (!context) {
  setCameraError('Unable to capture image.');
  return;
}
    
const isIdPhoto = [
  'front',
  'back',
  'representative_id'
].includes(side);

const videoWidth = video.videoWidth;
const videoHeight = video.videoHeight;

if (isIdPhoto) {
  // Crop ID images to the green guide
  const cardRatio = 1.586;
  const cropWidth = videoWidth * 0.8;
  const cropHeight = cropWidth / cardRatio;

  let finalWidth = cropWidth;
  let finalHeight = cropHeight;

  if (finalHeight > videoHeight * 0.8) {
    finalHeight = videoHeight * 0.8;
    finalWidth = finalHeight * cardRatio;
  }

  const sourceX = (videoWidth - finalWidth) / 2;
  const sourceY = (videoHeight - finalHeight) / 2;

  canvas.width = Math.round(finalWidth);
  canvas.height = Math.round(finalHeight);

  context.drawImage(
    video,
    sourceX,
    sourceY,
    finalWidth,
    finalHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
} else {
  // Full photo for storefront and business permit
  canvas.width = videoWidth;
  canvas.height = videoHeight;

  context.drawImage(
    video,
    0,
    0,
    videoWidth,
    videoHeight
  );
}


    // Reject photos that fail the blur check.
   
    // Check captured ID photo for blur
    const blurResult = checkImageBlur(canvas);

    console.log(
      'ID Photo Sharpness Score:',
      blurResult.score.toFixed(2)
    );

    if (blurResult.isBlurry) {
      setCameraError(
        `The ID photo appears blurry (Sharpness Score: ${blurResult.score.toFixed(2)}). ` +
        'Hold your camera steady, improve the lighting, and retake the photo.'
      );
      return;
    }

    // Clear previous camera errors
    setCameraError('');

    // Convert captured image into a file
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError(
            'Photo capture failed. Please try again.'
          );
          return;
        }

        const file = new File(
          [blob],
          `citipoints-id-${side}-${Date.now()}.jpg`,
          { type: 'image/jpeg' }
        );

        if (!validateFile(file)) return;

       if (side === 'front') {
  setIdFront(file);
} else if (side === 'back') {
  setIdBack(file);
} else if (side === 'business_permit') {
  setBusinessPermit(file);
} else if (side === 'storefront_photo') {
  setStorefrontPhoto(file);
} else if (side === 'representative_id') {
  setRepresentativeId(file);
}

        setMessage('');
        closeCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  // =====================================================
  // GENERAL FORM HANDLERS
  // =====================================================

 const handleChange = (e) => {
  const { name, value, type, checked } = e.target;

  setForm((previous) => ({
    ...previous,
    [name]: type === 'checkbox' ? checked : value,

    ...(
      name === 'id_type' ||
      name === 'representative_id_type'
        ? { other_id_type: '' }
        : {}
    )
  }));
};

  const showError = (text) => {
    setMessage(text);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // =====================================================
  // FILE VALIDATION
  // =====================================================

  const validateFile = (file) => {
    if (!file) return true;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      showError(
        'Only JPG, PNG, and PDF files are allowed.'
      );
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      showError(
        'Each file must not exceed 5 MB.'
      );
      return false;
    }

    return true;
  };

  const handleFileChange = (e, side) => {
  const file = e.target.files?.[0];

  if (!file) return;

  if (!validateFile(file)) {
    e.target.value = '';
    return;
  }

  if (
    side === 'storefront_photo' &&
    !['image/jpeg', 'image/png'].includes(file.type)
  ) {
    showError('Storefront photo must be JPG or PNG.');
    e.target.value = '';
    return;
  }

  setMessage('');

  if (side === 'front') {
    setIdFront(file);
  } else if (side === 'back') {
    setIdBack(file);
  } else if (side === 'business_permit') {
    setBusinessPermit(file);
  } else if (side === 'storefront_photo') {
    setStorefrontPhoto(file);
  } else if (side === 'representative_id') {
    setRepresentativeId(file);
  }

  e.target.value = '';
};

  // =====================================================
  // NAME VALIDATION
  // =====================================================

  const validateName = (name) => {
    const namePattern =
      /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;

    return namePattern.test(name.trim());
  };

  const validateIdNumber = () => {
  const idNumber = form.id_number.trim();

  if (!idNumber) {
    return 'ID number is required.';
  }

  if (
    idNumber.length < 3 ||
    idNumber.length > 50 ||
    !/^[A-Za-z0-9][A-Za-z0-9 /-]*[A-Za-z0-9]$/.test(idNumber)
  ) {
    return 'Enter a valid ID number (3–50 characters).';
  }

  return null;
};


const validateOtherIdType = (selectedType) => {
  if (selectedType !== 'other') {
    return null;
  }

  const customType = form.other_id_type.trim();

  if (
    customType.length < 3 ||
    customType.length > 40 ||
    !/^[\p{L}\p{M}][\p{L}\p{M}0-9 .()'/-]*$/u.test(customType)
  ) {
    return 'Enter a valid government-issued ID type (3–40 characters).';
  }

  return null;
};
  // =====================================================
  // PERSONAL INFORMATION VALIDATION
  // =====================================================

  
const validatePersonal = () => {
  // Required for both citizens and establishment representatives
  if (!form.date_of_birth) {
    return 'Date of birth is required.';
  }

  const dob = new Date(`${form.date_of_birth}T00:00:00`);
  const [year, month, day] = form.date_of_birth
    .split('-')
    .map(Number);

  if (
    Number.isNaN(dob.getTime()) ||
    dob.getFullYear() !== year ||
    dob.getMonth() + 1 !== month ||
    dob.getDate() !== day
  ) {
    return 'Enter a valid date of birth.';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dob > today) {
    return 'Date of birth cannot be in the future.';
  }

  if (!form.first_name.trim() || !form.last_name.trim()) {
    return 'First name and last name are required.';
  }

  if (
    !validateName(form.first_name) ||
    !validateName(form.last_name) ||
    (
      form.middle_name.trim() &&
      !validateName(form.middle_name)
    )
  ) {
    return 'Invalid name. Numbers and unsupported symbols are not allowed.';
  }

  if (!form.email.trim() || !form.phone.trim()) {
    return 'Email and phone number are required.';
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      form.email.trim()
    )
  ) {
    return 'Enter a valid email address.';
  }

  if (!/^09\d{9}$/.test(form.phone.trim())) {
    return 'Enter a valid Philippine mobile number.';
  }

  if (form.password.length < 8) {
    return 'Password must contain at least 8 characters.';
  }

  if (form.password !== form.confirm_password) {
    return 'Passwords do not match.';
  }

  return null;
};

// =====================================================
// Lgu Administrator VALIDATION
// =====================================================

const validateLGURepresentative = () => {
  
  if (!form.first_name.trim() || !form.last_name.trim()) {
    return 'First name and last name are required.';
  }

  if (
    !validateName(form.first_name) ||
    !validateName(form.last_name) ||
    (form.middle_name.trim() &&
      !validateName(form.middle_name))
  ) {
    return 'Please enter valid representative names.';
  }

  if (!form.date_of_birth) {
  return 'Date of birth is required.';
}

const dob = new Date(`${form.date_of_birth}T00:00:00`);
const [year, month, day] = form.date_of_birth
  .split('-')
  .map(Number);

if (
  Number.isNaN(dob.getTime()) ||
  dob.getFullYear() !== year ||
  dob.getMonth() + 1 !== month ||
  dob.getDate() !== day
) {
  return 'Enter a valid date of birth.';
}

const today = new Date();
today.setHours(0, 0, 0, 0);

if (dob > today) {
  return 'Date of birth cannot be in the future.';
}

  if (!form.lgu_designation.trim()) {
    return 'Official designation is required.';
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      form.email.trim()
    )
  ) {
    return 'Enter a valid email address.';
  }

  if (!/^09\d{9}$/.test(form.phone.trim())) {
    return 'Enter a valid Philippine mobile number.';
  }

  if (form.password.length < 8) {
    return 'Password must contain at least 8 characters.';
  }

  if (form.password !== form.confirm_password) {
    return 'Passwords do not match.';
  }

  return null;
};
// =====================================================
// LGU INFORMATION VALIDATION
// =====================================================

const validateLGUInformation = () => {
  if (!['city', 'barangay'].includes(form.lgu_level)) {
    return 'Please select your LGU level.';
  }

  if (form.lgu_level === 'city') {
    if (!form.lgu_office.trim()) {
      return 'Please enter the City Department or Office.';
    }
  }

  if (form.lgu_level === 'barangay') {
    if (!BARANGAYS.includes(form.lgu_barangay)) {
      return 'Please select a valid barangay.';
    }

    if (!form.lgu_office.trim()) {
      return 'Please select your Barangay Office or Unit.';
    }

    if (
      form.lgu_office === 'Other' &&
      !form.lgu_other_office.trim()
    ) {
      return 'Please specify the office or unit name.';
    }
  }

  if (!form.lgu_office_address.trim()) {
    return 'Official office address is required.';
  }

  if (!form.lgu_office_contact.trim()) {
    return 'Official office contact number is required.';
  }

  return null;
};
// =====================================================
// LGU DOCUMENT VALIDATION
// =====================================================

const validateLGUDocuments = () => {
  if (!lguLOI) {
    return 'Please upload your signed Letter of Intent.';
  }

  if (!lguId) {
    return 'Please upload your official employee or government ID.';
  }
  const idNumberError = validateIdNumber();

if (idNumberError) {
  return idNumberError;
}

  if (!validateFile(lguLOI) || !validateFile(lguId)) {
    return 'Please check the selected files.';
  }

  if (!form.lgu_authorization) {
    return 'Please confirm that you are officially authorized.';
  }

  if (!form.privacy_acknowledgment) {
    return 'Please acknowledge the privacy notice.';
  }

  return null;
};

  const validatePartnerBusiness = () => {
  if (!form.partner_name.trim()) {
    return 'Establishment name is required.';
  }

  if (!form.business_permit_number.trim()) {
    return 'Business permit number is required.';
  }

  if (!form.business_barangay) {
    return 'Select the establishment barangay.';
  }

  if (!BARANGAYS.includes(form.business_barangay)) {
    return 'Select a valid Mandaue City barangay.';
  }

  if (!form.business_address.trim()) {
    return 'Complete business address is required.';
  }

  return null;
};

const validatePartnerDocuments = () => {
  if (!businessPermit) {
    return 'Upload the business permit.';
  }

  if (!storefrontPhoto) {
    return 'Upload a storefront photo.';
  }

  if (!['image/jpeg', 'image/png'].includes(storefrontPhoto.type)) {
    return 'Storefront photo must be JPG or PNG.';
  }

  if (!form.representative_id_type) {
    return 'Select the representative ID type.';
  }

  if (!ID_TYPES.some((id) => id.value === form.representative_id_type)) {
    return 'Select an accepted representative ID.';
  }
  const otherTypeError = validateOtherIdType(
  form.representative_id_type
);

if (otherTypeError) {
  return otherTypeError;
}
  const idNumberError = validateIdNumber();

if (idNumberError) {
  return idNumberError;
}

  if (!representativeId) {
    return 'Upload the representative valid ID.';
  }

  if (!form.privacy_acknowledgment) {
    return 'Please acknowledge the privacy notice.';
  }

  return null;
};
  // =====================================================
  // RESIDENCY VALIDATION
  // =====================================================

  const validateResidency = () => {
    if (
      !form.barangay ||
      !form.address.trim()
    ) {
      return 'Barangay and residential address are required.';
    }

    return null;
  };
  

  // =====================================================
  // ID VERIFICATION VALIDATION
  // =====================================================

  const validateVerification = () => {
    if (!form.id_type) {
      return 'Please select a valid ID type.';
    }
    if (!ID_TYPES.some((id) => id.value === form.id_type)) {
  return 'Please select an accepted ID type.';
}

const otherTypeError = validateOtherIdType(form.id_type);

if (otherTypeError) {
  return otherTypeError;
}
    const idNumberError = validateIdNumber();

if (idNumberError) {
  return idNumberError;
}

    if (!idFront) {
      return 'Please upload or capture the front of your valid ID.';
    }

    if (!form.residency_declaration) {
      return 'Please confirm your residency declaration.';
    }

    if (!form.privacy_acknowledgment) {
      return 'Please acknowledge the privacy notice.';
    }

    return null;
  };

  // =====================================================
// STEP NAVIGATION
// =====================================================

const nextStep = () => {
  let error = null;

  if (isLGU) {
    if (step === 1) {
      error = validateLGUInformation();
    }

    if (step === 2) {
      error = validateLGURepresentative();
    }
  } else {
    if (step === 1) {
      error = validatePersonal();
    }

    if (step === 2) {
      if (isCitizen) {
        error = validateResidency();
      } else if (isPartner) {
        error = validatePartnerBusiness();
      }
    }
  }

  if (error) {
    showError(error);
    return;
  }

  setMessage('');
  setStep((previous) => Math.min(previous + 1, 3));
};

// =====================================================
// PREVIOUS STEP
// =====================================================

const previousStep = () => {
  setMessage('');

  setStep((previous) =>
    Math.max(previous - 1, 1)
  );
};

  // =====================================================
  // SUBMIT REGISTRATION
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLoading) return;

    if (!isLGU) {
  const personalError = validatePersonal();

  if (personalError) {
    setStep(1);
    showError(personalError);
    return;
  }
}

    if (isCitizen) {
      const residencyError = validateResidency();

      if (residencyError) {
        setStep(2);
        showError(residencyError);
        return;
      }

      const verificationError = validateVerification();

      if (verificationError) {
        showError(verificationError);
        return;
      }
    }
    if (isPartner) {
  const businessError = validatePartnerBusiness();

  if (businessError) {
    setStep(2);
    showError(businessError);
    return;
  }

  const documentsError = validatePartnerDocuments();

  if (documentsError) {
    setStep(3);
    showError(documentsError);
    return;
  }
}

if (isLGU) {
  const informationError = validateLGUInformation();

  if (informationError) {
    setStep(1);
    showError(informationError);
    return;
  }

  const representativeError = validateLGURepresentative();

  if (representativeError) {
    setStep(2);
    showError(representativeError);
    return;
  }

  const documentsError = validateLGUDocuments();

  if (documentsError) {
    setStep(3);
    showError(documentsError);
    return;
  }
}

    try {
      setIsLoading(true);
      setMessage('');

    
     const payload = new FormData();

payload.append('date_of_birth', form.date_of_birth);
payload.append('id_number', form.id_number.trim());
payload.append('other_id_type', form.other_id_type.trim());

      [
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'email',
        'phone',
        'password',
        'role'
      ].forEach((key) => {
        payload.append(key, form[key]);
      });

      if (isCitizen) {
        payload.append('city', 'Mandaue City');
        payload.append('barangay', form.barangay);
        payload.append('address', form.address);
        payload.append('id_type', form.id_type);
        payload.append('id_front', idFront);

        if (idBack) {
          payload.append('id_back', idBack);
        }

        payload.append(
          'residency_declaration',
          String(form.residency_declaration)
        );

        payload.append(
          'privacy_acknowledgment',
          String(form.privacy_acknowledgment)
        );
     } else if (isPartner) {
  payload.append(
  'partner_name',
  form.partner_name.trim()
);

  payload.append(
    'business_permit_number',
    form.business_permit_number.trim()
  );

  payload.append(
    'business_address',
    form.business_address.trim()
  );

  payload.append(
    'business_barangay',
    form.business_barangay
  );

  payload.append(
    'representative_id_type',
    form.representative_id_type
  );

  payload.append('city', 'Mandaue City');
  payload.append('barangay', form.business_barangay);
  payload.append('address', form.business_address);

  payload.append('business_permit', businessPermit);
  payload.append('storefront_photo', storefrontPhoto);
  payload.append('representative_id', representativeId);

  payload.append(
    'privacy_acknowledgment',
    String(form.privacy_acknowledgment)
  );
}
// =====================================================
// LGU REGISTRATION PAYLOAD
// =====================================================



      // =====================================================
      // LGU REGISTRATION PAYLOAD
      // =====================================================

      if (isLGU) {
        const selectedOffice =
          form.lgu_office === 'Other'
            ? form.lgu_other_office.trim()
            : form.lgu_office.trim();

        payload.append('city', 'Mandaue City');
        payload.append('lgu_level', form.lgu_level);
        payload.append('lgu_office', selectedOffice);

        payload.append(
          'lgu_barangay',
          form.lgu_level === 'barangay'
            ? form.lgu_barangay
            : ''
        );

        payload.append(
          'lgu_office_address',
          form.lgu_office_address.trim()
        );

        payload.append(
          'lgu_office_contact',
          form.lgu_office_contact.trim()
        );

        payload.append(
          'lgu_designation',
          form.lgu_designation.trim()
        );

        payload.append('lgu_loi', lguLOI);
        payload.append('lgu_id', lguId);

        payload.append(
          'lgu_authorization',
          String(form.lgu_authorization)
        );

        payload.append(
          'privacy_acknowledgment',
          String(form.privacy_acknowledgment)
        );
      }

      const response = await api.post(
        '/auth/register',
        payload
      );

     if (response.data.email_verification_required) {
  setVerificationEmail(form.email.trim().toLowerCase());
  setVerificationEmailSent(response.data.email_sent === true);
  setMessage('');
} else {
  alert(response.data.message || 'Registration successful!');
  navigate('/');
}
    } catch (error) {
      showError(
        error.response?.data?.message ||
        'Registration failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  // REUSABLE INPUT
  // =====================================================

  const renderInput = (
    label,
    name,
    placeholder,
    type = 'text',
    required = true
  ) => (

    <div className="citipoints-field">
      
      <label htmlFor={name}>{label}</label>

      <div className="citipoints-input-wrap">
       <input
  id={name}
  type={type}
  name={name}
  placeholder={placeholder}
  value={form[name]}
  onChange={handleChange}
  required={required}
maxLength={
  name === 'id_number' ? 50 :
  name === 'other_id_type' ? 40 :
  name === 'suffix' ? 10 :
  undefined
}
/>
      </div>
    </div>
  );

  // =====================================================
  // REUSABLE ID UPLOAD SECTION
  // =====================================================

  const renderIdUpload = (side) => {
    const isFront = side === 'front';
    const file = isFront ? idFront : idBack;
    const preview = isFront ? frontPreview : backPreview;

    return (
      <div className="citipoints-field">
        <label>
          {isFront
            ? 'ID Front *'
            : 'ID Back (if applicable)'}
        </label>

        <div className="id-upload-options">
          <button
            type="button"
            className="id-camera-btn"
            onClick={() => openCamera(side)}
          >
            📷 Take Photo
          </button>

          <label className="id-gallery-btn">
            🖼️ Upload from Gallery

            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => handleFileChange(e, side)}
              hidden
            />
          </label>
        </div>

        {file && (
          <div className="id-file-selected">
            <span>✓ Selected: {file.name}</span>

            {preview && (
              <img
                src={preview}
                alt={isFront
                  ? 'ID front preview'
                  : 'ID back preview'}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 180,
                  marginTop: 10,
                  borderRadius: 8
                }}
              />
            )}

            <button
              type="button"
              onClick={() => {
                if (isFront) {
                  setIdFront(null);
                } else {
                  setIdBack(null);
                }
              }}
              style={{
                display: 'block',
                marginTop: 8
              }}
            >
              Remove Photo
            </button>
          </div>
        )}
      </div>
    );
  };


  

const renderPartnerUpload = (title, side, file, setFile) => {
  const isStorefront = side === 'storefront_photo';

  return (
    <div className="citipoints-field">
      <label>{title} *</label>

      <div className="id-upload-options">
        <button
          type="button"
          className="id-camera-btn"
          onClick={() => openCamera(side)}
        >
          📷 Take Photo
        </button>

        <label className="id-gallery-btn">
          🖼️ Upload from Gallery

          <input
            type="file"
            accept={
              isStorefront
                ? 'image/jpeg,image/png'
                : 'image/jpeg,image/png,application/pdf'
            }
            onChange={(e) => handleFileChange(e, side)}
            style={{
              display: 'none',
              visibility: 'hidden',
              position: 'absolute',
              width: 0,
              height: 0
            }}
          />
        </label>
      </div>

      {file && (
        <div className="id-file-selected">
          <span>✓ Selected: {file.name}</span>

          <button
            type="button"
            onClick={() => setFile(null)}
            style={{ marginTop: 8 }}
          >
            Remove Photo
          </button>
        </div>
      )}
    </div>
  );
};


  // =====================================================
  // CAMERA MODAL
  // =====================================================

  const renderCameraModal = () => {
    if (!cameraSide) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Capture ID photo"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 680,
            padding: 20,
            color: '#122c50'
          }}
        >
          <h3 style={{ marginTop: 0 }}>
  {cameraSide === 'front'
    ? 'Take ID Front Photo'
    : cameraSide === 'back'
      ? 'Take ID Back Photo'
      : cameraSide === 'business_permit'
        ? 'Take Business Permit Photo'
        : cameraSide === 'storefront_photo'
          ? 'Take Storefront Photo'
          : 'Take Representative ID Photo'}
</h3>

          <p style={{ fontSize: 14 }}>
           {cameraSide === 'storefront_photo'
  ? 'Make sure the establishment storefront is clearly visible.'
  : cameraSide === 'business_permit'
    ? 'Make sure the entire business permit is visible and readable.'
    : 'Place the whole ID inside the camera frame. Make sure all text is readable.'}
          </p>

          
<div
  style={{
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    background: '#111'
  }}
>
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
    style={{
      display: 'block',
      width: '100%',
      aspectRatio: '4 / 3',
      objectFit: 'cover'
    }}
  />

 
{/* ID CARD GUIDE - ONLY FOR VALID IDS */}
{['front', 'back', 'representative_id'].includes(cameraSide) && (
  <div
    style={{
      position: 'absolute',
      left: '10%',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '80%',
      aspectRatio: '1.586 / 1',
      maxHeight: '80%',
      border: '3px solid #39e58c',
      borderRadius: 14,
      boxShadow: '0 0 0 999px rgba(0,0,0,0.35)',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <span
      style={{
        position: 'absolute',
        bottom: 10,
        background: 'rgba(0,0,0,0.65)',
        color: '#fff',
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 12
      }}
    >
      Align your ID inside this frame
    </span>
  </div>
)}

</div>


          {cameraLoading && (
            <p>
              Opening camera... Please allow camera permission.
            </p>
          )}

          {cameraError && (
            <p
              role="alert"
              style={{ color: '#b42318' }}
            >
              {cameraError}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 16
            }}
          >
            <button
              type="button"
              className="id-camera-btn"
              onClick={capturePhoto}
              disabled={cameraLoading || !!cameraError}
            >
              📸 Capture Photo
            </button>

            <button
              type="button"
              className="registration-back-btn"
              onClick={closeCamera}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =====================================================
  // PAGE DESIGN
  // =====================================================

  return (
    <div className="citipoints-auth-page citipoints-register-page">
      {verificationEmail && (
  <EmailVerification
    email={verificationEmail}
    initialEmailSent={verificationEmailSent}
    onClose={() => navigate('/')}
    onVerified={() => {
      alert('Email verified successfully. You may now log in.');
      navigate('/');
    }}
  />
)}

      {/* LEFT SIDE */}
     <section
  className="citipoints-auth-hero register-hero"
  style={{
    backgroundImage: "url('/Mandaue.jpeg')"
  }}
>
        <div className="citipoints-auth-shade"></div>

        <div className="citipoints-hero-content">
          <img
            src="/CitiPoints Mandaue City Logo.png"
            alt="CitiPoints"
            className="citipoints-hero-logo"
          />

          <div className="citipoints-hero-message">
            <h1>
              Be Part of the
              <span> Community.</span>
            </h1>

            <p>
              Create your CitiPoints account and help
              strengthen citizen participation in Mandaue City.
            </p>

            <div className="citipoints-benefits register-benefits">
              <div>
                <span className="benefit-icon">👥</span>
                <strong>Join Activities</strong>
              </div>

              <div>
                <span className="benefit-icon">★</span>
                <strong>Earn Smart Points</strong>
              </div>

              <div>
                <span className="benefit-icon">🎁</span>
                <strong>Redeem Rewards</strong>
              </div>
            </div>

            <div className="citipoints-hero-quote">
              A Stronger Mandaue Starts with You.
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="citipoints-auth-form-side register-form-side">

        <div className="citipoints-top-message">
          Together for a Better Mandaue
        </div>

        <div className="citipoints-form-container register-container">

          <img
            src="/citipoints-logo.png"
            alt="CitiPoints"
            className="citipoints-form-logo"
          />

       <div className="citipoints-form-heading">
  <h2>
    {isLGU ? 'LGU Registration' : 'Create Your Account'}
  </h2>

  <p>
    {isLGU
      ? step === 1
        ? 'Provide your official LGU information.'
        : step === 2
          ? 'Enter the authorized representative details.'
          : 'Submit your authorization documents.'
      : step === 1
        ? 'Enter your personal information.'
        : step === 2
          ? isCitizen
            ? 'Provide your residential details.'
            : 'Provide your establishment details.'
          : isCitizen
            ? 'Verify your identity and residency.'
            : 'Upload your establishment verification documents.'}
  </p>
</div>

         <div className="registration-progress">
         
  <span>Step {step} of 3</span>

  <div className="registration-progress-track">
    <div
      className="registration-progress-fill"
      style={{
        width: `${(step / 3) * 100}%`
      }}
    />
  </div>
</div>

          {message && (
            <div
              className="registration-error"
              role="alert"
            >
              {message}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="citipoints-form"
          >



            {/* ACCOUNT TYPE - SHARED BY ALL REGISTRATIONS */}

{/* ACCOUNT TYPE SELECTION */}
<div className="citipoints-field">
  <label htmlFor="role">Account Type *</label>

  <select
    id="role"
    name="role"
    value={form.role}
   onChange={(e) => {
  setForm((prev) => ({
    ...prev,
role: e.target.value,
id_number: '',
id_type: '',
representative_id_type: '',
other_id_type: ''
  }));

  setStep(1);
  setMessage('');
}}
    required
    style={{
      display: 'block',
      width: '100%',
      minHeight: '56px',
      padding: '12px 16px',
      border: '1px solid #cbd5e1',
      borderRadius: '10px',
      backgroundColor: '#ffffff',
      color: '#12345a',
      fontSize: '16px',
      cursor: 'pointer',
      pointerEvents: 'auto',
      opacity: 1
    }}
  >
    <option value="community_member">
      Citizen
    </option>

    <option value="partner">
      Establishment 
    </option>

    <option value="lgu">
      Lgu Administrator
    </option>
  </select>
</div>


            {/* STEP 1 - CITIZEN AND PARTNER ONLY */}
{step === 1 && !isLGU && (
              <>
                <h3>Personal Information</h3>

                <div className="registration-name-grid">
                  {renderInput(
                    'First Name *',
                    'first_name',
                    'Enter first name'
                  )}

                  {renderInput(
                    'Middle Name',
                    'middle_name',
                    'Enter middle name',
                    'text',
                    false
                  )}

                  {renderInput(
                    'Last Name *',
                    'last_name',
                    'Enter last name'
                  )}

                {renderInput(
  'Suffix (Optional)',
  'suffix',
  'e.g., Jr., Sr., III, IV',
  'text',
  false
)}
                  
                </div>
                 
<div className="registration-details-grid">

  <div className="citipoints-field">
    
    <label htmlFor="date_of_birth">
      Date of Birth *
    </label>

    <div className="citipoints-input-wrap">
      <input
        id="date_of_birth"
        name="date_of_birth"
        type="date"
        value={form.date_of_birth}
        onChange={handleChange}
        max={new Date().toLocaleDateString('en-CA')}
        required
      />
    </div>
  </div>

                  


                {renderInput(
                  'Email Address *',
                  'email',
                  'Enter email address',
                  'email'
                )}

                {renderInput(
                  'Phone Number *',
                  'phone',
                  '09XXXXXXXXX',
                  'tel'
                )}

                <div className="citipoints-field">
                  <label htmlFor="password">
                    Password *
                  </label>

                  <div className="citipoints-input-wrap">
                    <input
                      id="password"
                      type={showPassword
                        ? 'text'
                        : 'password'}
                      name="password"
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      onChange={handleChange}
                      required
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
                    >
                      {showPassword
                        ? 'Hide'
                        : 'Show'}
                    </button>
                  </div>
                </div>


{renderInput(
  'Confirm Password *',
  'confirm_password',
  'Re-enter password',
  'password'
)}

</div>
<div className="registration-actions">
  <button
    type="button"
    className="citipoints-submit-btn"
    onClick={nextStep}
    disabled={isLoading}
  >
    CONTINUE →
  </button>
</div>

</>
)}

{/* STEP 2 */}

            {step === 2 && isCitizen && (
              <>
                <h3>Residential Information</h3>

                <div className="citipoints-field">
                  <label>City</label>

                  <input
                    type="text"
                    value="Mandaue City, Cebu"
                    readOnly
                  />
                </div>

                <div className="citipoints-field">
                  <label htmlFor="barangay">
                    Barangay *
                  </label>

                  <select
                    id="barangay"
                    name="barangay"
                    value={form.barangay}
                    onChange={handleChange}
                    required
                  >
                    <option value="">
                      Select Barangay
                    </option>

                    {BARANGAYS.map((barangay) => (
                      <option
                        key={barangay}
                        value={barangay}
                      >
                        {barangay}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="citipoints-field">
                  <label htmlFor="address">
                    Complete Residential Address *
                  </label>

                  <textarea
                    id="address"
                    name="address"
                    rows="3"
                    placeholder="House No., Street, Purok/Sitio, Subdivision"
                    value={form.address}
                    onChange={handleChange}
                    required
                  />
                </div>

                <p className="registration-note">
                  Your residential information will be reviewed
                  by an authorized LGU Administrator.
                </p>

                <div className="registration-actions">
                  <button
                    type="button"
                    onClick={previousStep}
                    className="registration-back-btn"
                  >
                    ← BACK
                  </button>

                 <button
  type="button"
  className="citipoints-submit-btn"
  onClick={nextStep}
  disabled={isLoading}
>
  CONTINUE →
</button>
                </div>
              </>
            )}


            {/* STEP 2 - PARTNER BUSINESS INFORMATION */}
{step === 2 && isPartner && (
  <>
    <h3>Establishment Information</h3>

    {renderInput(
      'Establishment / Business Name *',
      'partner_name',
      'Enter registered business name'
    )}

    {renderInput(
      'Business Permit Number *',
      'business_permit_number',
      'Enter business permit number'
    )}

    <div className="citipoints-field">
      <label>City</label>
      <input type="text" value="Mandaue City, Cebu" readOnly />
    </div>

    <div className="citipoints-field">
      <label htmlFor="business_barangay">
        Business Barangay *
      </label>

      <select
        id="business_barangay"
        name="business_barangay"
        value={form.business_barangay}
        onChange={handleChange}
        required
      >
        <option value="">Select Barangay</option>

        {BARANGAYS.map((barangay) => (
          <option key={barangay} value={barangay}>
            {barangay}
          </option>
        ))}
      </select>
    </div>

    <div className="citipoints-field">
      <label htmlFor="business_address">
        Complete Business Address *
      </label>

      <textarea
        id="business_address"
        name="business_address"
        rows="3"
        placeholder="Building, Street, Purok/Sitio"
        value={form.business_address}
        onChange={handleChange}
        required
      />
    </div>

    <p className="registration-note">
      Your establishment information will be reviewed
      by the LGU Administrator.
    </p>

    <div className="registration-actions">
      <button
        type="button"
        className="registration-back-btn"
        onClick={previousStep}
      >
        ← BACK
      </button>

      <button
        type="button"
        className="citipoints-submit-btn"
        onClick={nextStep}
      >
        CONTINUE →
      </button>
    </div>
  </>
)}

            {/* STEP 3 - ID VERIFICATION */}


{/* ============================================== */}
{/* STEP 2 - LGU INFORMATION                     */}
{/* ============================================== */}


{/* ============================================ */}
{/* LGU STEP 1 - GOVERNMENT INFORMATION         */}
{/* ============================================ */}

{step === 1 && isLGU && (
  <>
    <h3>LGU Information</h3>

    <p className="registration-note">
      Identify the local government office
      requesting access to CitiPoints.
    </p>

    <div className="citipoints-field">
      <label htmlFor="lgu_level">LGU Level *</label>

      <select
        id="lgu_level"
        name="lgu_level"
        value={form.lgu_level}
        onChange={(e) => {
          setForm((previous) => ({
            ...previous,
            lgu_level: e.target.value,
            lgu_office: '',
            lgu_other_office: '',
            lgu_barangay: ''
          }));
        }}
      >
        <option value="">Select LGU Level</option>
        <option value="city">City Government</option>
        <option value="barangay">Barangay Government</option>
      </select>
    </div>

    {/* CITY GOVERNMENT */}
    {form.lgu_level === 'city' && (
      <div className="citipoints-field">
        <label htmlFor="lgu_office">
          City Department / Office *
        </label>

        <input
          id="lgu_office"
          name="lgu_office"
          type="text"
          placeholder="e.g. City Health Office"
          value={form.lgu_office}
          onChange={handleChange}
        />
      </div>
    )}

    {/* BARANGAY GOVERNMENT */}
    {form.lgu_level === 'barangay' && (
      <>
        <div className="citipoints-field">
          <label htmlFor="lgu_barangay">
            Select Barangay *
          </label>

          <select
            id="lgu_barangay"
            name="lgu_barangay"
            value={form.lgu_barangay}
            onChange={handleChange}
          >
            <option value="">Select Barangay</option>

            {BARANGAYS.map((barangay) => (
              <option key={barangay} value={barangay}>
                {barangay}
              </option>
            ))}
          </select>
        </div>

        <div className="citipoints-field">
          <label htmlFor="lgu_office">
            Barangay Office / Unit *
          </label>

          <select
            id="lgu_office"
            name="lgu_office"
            value={form.lgu_office}
            onChange={(e) => {
              setForm((previous) => ({
                ...previous,
                lgu_office: e.target.value,
                lgu_other_office: ''
              }));
            }}
          >
            <option value="">Select Office / Unit</option>
            <option value="Office of the Barangay Captain">
              Office of the Barangay Captain
            </option>
            <option value="Barangay Secretary's Office">
              Barangay Secretary's Office
            </option>
            <option value="Barangay Treasurer's Office">
              Barangay Treasurer's Office
            </option>
            <option value="Barangay Health Services">
              Barangay Health Services
            </option>
            <option value="Barangay Peace and Order">
              Barangay Peace and Order
            </option>
            <option value="Barangay Disaster Response">
              Barangay Disaster Response
            </option>
            <option value="Barangay VAW Desk">
              Barangay VAW Desk
            </option>
            <option value="Sangguniang Kabataan">
              Sangguniang Kabataan
            </option>
            <option value="Other">
              Other Office / Unit
            </option>
          </select>
        </div>

        {form.lgu_office === 'Other' && (
          <div className="citipoints-field">
            <label htmlFor="lgu_other_office">
              Specify Office / Unit *
            </label>

            <input
              id="lgu_other_office"
              name="lgu_other_office"
              type="text"
              value={form.lgu_other_office}
              onChange={handleChange}
              placeholder="Enter office or unit name"
            />
          </div>
        )}
      </>
    )}

    {form.lgu_level && (
      <>
        <div className="citipoints-field">
          <label htmlFor="lgu_office_address">
            Official Office Address *
          </label>

          <textarea
            id="lgu_office_address"
            name="lgu_office_address"
            rows="3"
            placeholder="Complete office address"
            value={form.lgu_office_address}
            onChange={handleChange}
          />
        </div>

        {renderInput(
          'Official Office Contact Number *',
          'lgu_office_contact',
          'Enter official office number',
          'tel'
        )}
      </>
    )}

    <button
      type="button"
      className="citipoints-submit-btn"
      onClick={nextStep}
    >
      CONTINUE →
    </button>
  </>
)}


{/* ============================================ */}
{/* LGU STEP 2 - AUTHORIZED REPRESENTATIVE      */}
{/* ============================================ */}

{step === 2 && isLGU && (
  <>
    <h3>Authorized Representative</h3>

    <p className="registration-note">
      Enter the information of the person officially
      authorized to operate this LGU account.
    </p>

    <div className="registration-name-grid">
      {renderInput(
        'First Name *',
        'first_name',
        'Enter first name'
      )}

      {renderInput(
        'Middle Name',
        'middle_name',
        'Enter middle name',
        'text',
        false
      )}

      {renderInput(
        'Last Name *',
        'last_name',
        'Enter last name'
      )}

     {renderInput(
  'Suffix (Optional)',
  'suffix',
  'e.g., Jr., Sr., III, IV',
  'text',
  false
)}
    </div>


      {/* DATE OF BIRTH */}
<div className="citipoints-field">
  <label htmlFor="lgu_date_of_birth">
    Date of Birth *
  </label>

  <div className="citipoints-input-wrap">
    <input
      id="lgu_date_of_birth"
      name="date_of_birth"
      type="date"
      value={form.date_of_birth}
      onChange={handleChange}
      max={new Date().toLocaleDateString('en-CA')}
      required
    />
  </div>
</div>
    {renderInput(
      'Official Designation / Position *',
      'lgu_designation',
      'e.g. Barangay Secretary or Administrative Officer'
    )}

    {renderInput(
      'Official Email Address *',
      'email',
      'Enter work email',
      'email'
    )}

    {renderInput(
      'Mobile Number *',
      'phone',
      '09XXXXXXXXX',
      'tel'
    )}

    <div className="citipoints-field">
      <label htmlFor="password">Password *</label>

      <div className="citipoints-input-wrap">
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Minimum 8 characters"
          value={form.password}
          onChange={handleChange}
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>

    {renderInput(
      'Confirm Password *',
      'confirm_password',
      'Re-enter password',
      'password'
    )}

    <div className="registration-actions">
      <button
        type="button"
        className="registration-back-btn"
        onClick={previousStep}
      >
        ← BACK
      </button>

      <button
        type="button"
        className="citipoints-submit-btn"
        onClick={nextStep}
      >
        CONTINUE →
      </button>
    </div>
  </>
)}



{/* ============================================== */}
{/* STEP 3 - LGU ACCOUNT VERIFICATION             */}
{/* ============================================== */}

{step === 3 && isLGU && (
  <>
    <h3>LGU Authorization & Verification</h3>

    <p className="registration-note">
      Upload your signed authorization letter
      and valid identification for City LGU review.
    </p>

   <div className="registration-status">
  <strong>Requesting Office</strong>

  <p>
    LGU Level: {form.lgu_level === 'city'
      ? 'City Government'
      : 'Barangay Government'}
  </p>

  {form.lgu_level === 'barangay' && (
    <p>Barangay: {form.lgu_barangay}</p>
  )}

  <p>
    Office / Unit:{' '}
    {form.lgu_office === 'Other'
      ? form.lgu_other_office
      : form.lgu_office}
  </p>

  <p>
    Official Designation: {form.lgu_designation}
  </p>
</div>

    {/* LETTER OF INTENT */}

    <div className="citipoints-field">
      <label>Letter of Intent (LOI) *</label>

      <p className="registration-note">
        {form.lgu_level === 'city'
          ? 'Obtain the signature of the appropriate authorized department or office official.'
          : 'Obtain the signature of your Barangay Captain or duly authorized acting official.'}
      </p>

      <a
        href="/lgu-loi-template.pdf"
        download
        className="id-gallery-btn"
      >
        📄 Download LOI Template
      </a>

      <p className="registration-note">
        Complete the template and upload a clear
        signed PDF or scanned image.
      </p>

      <div style={{ marginTop: 12 }}>
        <label className="id-gallery-btn">
          📁 Upload Signed LOI

          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file && validateFile(file)) {
                setLguLOI(file);
                setMessage('');
              }

              e.target.value = '';
            }}
          />
        </label>
      </div>

      {lguLOI && (
        <div className="id-file-selected">
          <span>✓ Selected: {lguLOI.name}</span>

          <button
            type="button"
            onClick={() => setLguLOI(null)}
          >
            Remove
          </button>
        </div>
      )}
    </div>
      {renderInput(
  'Official ID Number *',
  'id_number',
  'Enter official employee or government ID number',
  'text',
  true
)}
    {/* REPRESENTATIVE GOVERNMENT ID */}


    <div className="citipoints-field">
      <label>Official Employee / Government ID *</label>

      <p className="registration-note">
        Upload a clear government-issued ID
        or official employee ID belonging
        to the registering representative.
      </p>

      <label className="id-gallery-btn">
        📁 Upload Representative ID

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (file && validateFile(file)) {
              setLguId(file);
              setMessage('');
            }

            e.target.value = '';
          }}
        />
      </label>

      {lguId && (
        <div className="id-file-selected">
          <span>✓ Selected: {lguId.name}</span>

          <button
            type="button"
            onClick={() => setLguId(null)}
          >
            Remove
          </button>
        </div>
      )}
    </div>

    <p className="registration-note">
      Accepted formats: JPG, PNG and PDF.
      Maximum file size: 5 MB each.
    </p>

    {/* OFFICIAL AUTHORIZATION */}

    <div className="registration-checkbox">
      <label>
        <input
          type="checkbox"
          name="lgu_authorization"
          checked={form.lgu_authorization}
          onChange={handleChange}
        />

        I certify that I am officially authorized
        to request a CitiPoints account on behalf
        of the selected government office.
      </label>
    </div>

    {/* PRIVACY ACKNOWLEDGMENT */}

    <div className="registration-checkbox">
      <label>
        <input
          type="checkbox"
          name="privacy_acknowledgment"
          checked={form.privacy_acknowledgment}
          onChange={handleChange}
        />

        I acknowledge the CitiPoints privacy notice
        and understand that my information and
        documents will be processed for LGU
        registration verification.
      </label>
    </div>

    {/* APPLICATION STATUS */}

    <div className="registration-status">
      <strong>Application Status: Pending Review</strong>

      <p>
        After submission, the City LGU Super Admin
        must verify and approve your registration
        before your account becomes active.
      </p>
    </div>

    <div className="registration-actions">
      <button
        type="button"
        className="registration-back-btn"
        onClick={previousStep}
      >
        ← BACK
      </button>

      <button
        type="submit"
        className="citipoints-submit-btn"
        disabled={isLoading}
      >
        {isLoading
          ? 'SUBMITTING...'
          : 'SUBMIT LGU REGISTRATION →'}
      </button>
    </div>
  </>
)}

            {step === 3 && isCitizen && (
              <>
                <h3>
                  Identity & Residency Verification
                </h3>

                <p className="registration-note">
                  Submit one accepted government-issued ID.
                  The LGU will review your information.
                </p>

                <div className="citipoints-field">
                  <label htmlFor="id_type">
                    Valid ID Type *
                  </label>

                  <select
                    id="id_type"
                    name="id_type"
                    value={form.id_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">
                      Select Valid ID
                    </option>

                    {ID_TYPES.map((id) => (
                      <option
                        key={id.value}
                        value={id.value}
                      >
                        {id.label}
                      </option>
                    ))}
                  </select>
                </div>
                {form.id_type === 'other' && (
  renderInput(
    'Specify ID Type *',
    'other_id_type',
    'e.g., Postal ID, PWD ID',
    'text',
    true
  )
)}
                {renderInput(
  'ID Number *',
  'id_number',
  'Enter your ID number',
  'text',
  true
)}

                {/* CAMERA AND GALLERY */}
                {renderIdUpload('front')}
                {renderIdUpload('back')}

                <p className="registration-note">
                  Accepted: JPG, PNG, PDF.
                  Maximum 5 MB per file.
                  Ensure the ID is readable and belongs to you.
                </p>

                <div className="registration-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      name="residency_declaration"
                      checked={form.residency_declaration}
                      onChange={handleChange}
                    />

                    I declare that I am a current resident of
                    the selected barangay in Mandaue City and
                    that the information provided is accurate.
                  </label>
                </div>

                <div className="registration-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      name="privacy_acknowledgment"
                      checked={form.privacy_acknowledgment}
                      onChange={handleChange}
                    />

                    I acknowledge that my identification
                    document and personal information will
                    be processed for LGU verification,
                    subject to the CitiPoints privacy notice.
                  </label>
                </div>

                <div className="registration-status">
                  <strong>
                    Verification Status: Pending
                  </strong>

                  <p>
                    Your account will be reviewed by an LGU
                    Administrator. Smart Points earning and
                    redemption will be restricted until approval.
                  </p>
                </div>

                <div className="registration-actions">
                  <button
                    type="button"
                    className="registration-back-btn"
                    onClick={previousStep}
                  >
                    ← BACK
                  </button>

                  <button
                    type="submit"
                    className="citipoints-submit-btn"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? 'SUBMITTING...'
                      : 'CREATE ACCOUNT →'}
                  </button>
                </div>
              </>
            )}

 
{/* STEP 3 - PARTNER VERIFICATION */}
{step === 3 && isPartner && (
  <>
    <h3>Establishment Verification</h3>

    <p className="registration-note">
      Upload the required documents. The LGU Administrator
      will review your establishment before activation.
    </p>

    {/* BUSINESS PERMIT */}
    {renderPartnerUpload(
      'Business Permit',
      'business_permit',
      businessPermit,
      setBusinessPermit
    )}

    {/* STOREFRONT PHOTO */}
    {renderPartnerUpload(
      'Storefront Photo',
      'storefront_photo',
      storefrontPhoto,
      setStorefrontPhoto
    )}
      {renderInput(
  'Representative ID Number *',
  'id_number',
  'Enter representative ID number',
  'text',
  true
)}
    {/* REPRESENTATIVE ID TYPE */}
    <div className="citipoints-field">
      <label htmlFor="representative_id_type">
        Representative Valid ID Type *
      </label>

      <select
        id="representative_id_type"
        name="representative_id_type"
        value={form.representative_id_type}
        onChange={handleChange}
        required
      >
        <option value="">Select Valid ID</option>

        {ID_TYPES.map((id) => (
          <option key={id.value} value={id.value}>
            {id.label}
          </option>
        ))}
      </select>
    </div>

{/* SPECIFY OTHER REPRESENTATIVE ID TYPE */}
{form.representative_id_type === 'other' && (
  renderInput(
    'Specify Representative ID Type *',
    'other_id_type',
    'e.g., Postal ID, PWD ID',
    'text',
    true
  )
)}
    {/* REPRESENTATIVE VALID ID */}
    {renderPartnerUpload(
      'Representative Valid ID',
      'representative_id',
      representativeId,
      setRepresentativeId
    )}

    {/* PRIVACY ACKNOWLEDGMENT */}
    <div className="registration-checkbox">
      <label>
        <input
          type="checkbox"
          name="privacy_acknowledgment"
          checked={form.privacy_acknowledgment}
          onChange={handleChange}
        />

        I confirm that I am authorized to register this
        establishment and acknowledge that the submitted
        documents will be processed for LGU verification.
      </label>
    </div>

    {/* VERIFICATION STATUS */}
    <div className="registration-status">
      <strong>Verification Status: Pending</strong>

      <p>
        The establishment cannot access partner features
        until the LGU Administrator approves registration.
      </p>
    </div>

    {/* NAVIGATION BUTTONS */}
    <div className="registration-actions">
      <button
        type="button"
        className="registration-back-btn"
        onClick={previousStep}
      >
        ← BACK
      </button>

      <button
        type="submit"
        className="citipoints-submit-btn"
        disabled={isLoading}
      >
        {isLoading
          ? 'SUBMITTING...'
          : 'SUBMIT ESTABLISHMENT REGISTRATION →'}
      </button>
    </div>
  </>
)}

          </form>

          <div className="citipoints-divider">
            <span></span>
            <p>or</p>
            <span></span>
          </div>

          <p className="citipoints-switch-auth">
            Already have an account?{' '}
            <Link to="/">Sign In</Link>
          </p>
        </div>

        <div className="citipoints-location">
          <strong>Mandaue City</strong>
          <span>Cebu, Philippines</span>
        </div>
      </section>

      {/* LIVE CAMERA MODAL */}
      {renderCameraModal()}
    </div>
  );
}

export default RegisterPage;
