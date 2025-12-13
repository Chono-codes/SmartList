$(document).ready(function () {

    // ======== SUPABASE INITIALIZATION ========
    const SUPABASE_URL = "https://oujuojtsxphzhilteewf.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91anVvanRzeHBoemhpbHRlZXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDEyMDksImV4cCI6MjA4MTIxNzIwOX0.HI-9au5liqCGr8t_oYthzAOY5oXeyJqZqS6cPt3chis";
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ======== RESTORE SESSION FOR MOBILE SAFETY ========
    (async () => {
        await supabase.auth.getSession();
        supabase.auth.onAuthStateChange((_event, session) => {
            if (session && session.user) {
                console.log("Session active:", session.user.email);
            }
        });
    })();

    // ======== CHECK AUTHENTICATION ========
    (async function checkAuth() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            window.location.href = 'sign-in.html';
        } else {
            loadTasks();
        }
    })();

    // ======== LOGOUT FUNCTION ========
    $(document).on('click', '#logoutBtn', async function () {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            alert('You have been logged out.');
            window.location.href = 'sign-in.html';
        } catch (err) {
            console.error(err);
            alert('Logout failed. Try again.');
        }
    });

    // ======== SECTION NAVIGATION ========
    const $sections = $('section[id]');
    function showSectionById(id) {
        if (!id) return;
        $sections.hide();
        const $target = $('#' + CSS.escape(id));
        if ($target.length) {
            $target.fadeIn(180);
            $('.top-bar a').not('.brand').removeClass('active');
            const $anchor = $(`.top-bar a[href="#${id}"]`);
            if ($anchor.length) $anchor.addClass('active');
            $('.brand').addClass('active');
        }
    }
    $sections.hide(); $('#home').show(); $('.brand').addClass('active');
    if (location.hash) showSectionById(location.hash.replace(/^#/, ''));
    $('.top-bar a').on('click', function (e) {
        const href = $(this).attr('href') || '';
        const hashIndex = href.indexOf('#');
        if (hashIndex !== -1) {
            const id = href.slice(hashIndex + 1);
            if ($('#' + CSS.escape(id)).length) {
                e.preventDefault();
                showSectionById(id);
                history.pushState(null, '', '#' + id);
            }
        }
    });
    $(window).on('popstate hashchange', function () {
        const currentHash = location.hash.replace(/^#/, '');
        showSectionById(currentHash || 'home');
    });

    // ======== RESPONSIVE TABLE ========
    function handleTableVisibility() {
        window.innerWidth <= 768 ? $('.tasks-table').hide() : $('.tasks-table').show();
    }
    handleTableVisibility();
    $(window).on('resize', handleTableVisibility);

    // ======== SUBJECT NAME TOGGLING ========
    const $subjectSelect = $('.taskTable select').eq(0);
    const $subjectNameInput = $('.taskTable input[type="text"]').eq(1);
    $subjectNameInput.hide();
    $subjectSelect.on('change', function () {
        $(this).val() === 'others' ? $subjectNameInput.fadeIn(200) : $subjectNameInput.hide();
    });

    // ======== USER & PROFILE FUNCTIONS ========
    async function getUser() {
        await supabase.auth.refreshSession();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            $('#userName').text('No user logged in.');
            $('#profilePic').attr('src', 'default-avatar.png');
            return null;
        }
        const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
        const displayName = profile?.full_name || user.email;
        const profilePic = profile?.profile_pic || getGravatarUrl(user.email);
        $('#userName').html(`<strong>${displayName}</strong>`);
        $('#profilePic').attr('src', profilePic);
        return user;
    }

    function getGravatarUrl(email) {
        const hash = CryptoJS.MD5(email.trim().toLowerCase()).toString();
        return `https://www.gravatar.com/avatar/${hash}?d=mp&s=200`;
    }

    $(window).on('hashchange', function () {
        if (location.hash === '#account') getUser();
    });
    if (location.hash === '#account') getUser();

    // ======== PROFILE PICTURE UPLOAD (WORKS IN WEB APP + BROWSER) ========
    $(document).on('click', '#changePicBtn', function () {
        $('#uploadProfilePic').click();
    });

    $(document).on('change', '#uploadProfilePic', async function (event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) console.warn("Session refresh failed:", sessionError);
            if (!session || !session.user) {
                alert("You must be logged in to upload a profile picture.");
                return;
            }

            const user = session.user;
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('profile_pics')
                .upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: publicData, error: urlError } = await supabase
                .storage
                .from('profile_pics')
                .getPublicUrl(filePath);
            if (urlError) throw urlError;

            const publicUrl = publicData.publicUrl;

            const { error: updateError } = await supabase
                .from('users')
                .update({ profile_pic: publicUrl })
                .eq('id', user.id);
            if (updateError) throw updateError;

            $('#profilePic').attr('src', publicUrl);
            alert('Profile picture updated successfully!');
        } catch (err) {
            console.error("Upload error:", err);
            alert("Upload failed — session or permission issue.");
        } finally {
            $('#uploadProfilePic').val('');
        }
    });

    // ======== ADD TASK ========
    window.add = async function () {
        const activity = $('.taskTable input[type="text"]').eq(0).val().trim();
        const subject = $subjectSelect.val();
        const subjectName = $subjectNameInput.val().trim();
        const date = $('.taskTable input[type="date"]').val();
        if (!activity || subject === 'select' || !date) {
            alert('Fill all fields.');
            return;
        }

        const subjectFullNames = {
            "ict": "Information and Communication Technology",
            "math": "Mathematics",
            "science": "Science",
            "english": "English",
            "filipino": "Filipino",
            "ucsp": "Understanding Culture, Society, and Politics",
            "eapp": "English for Academic and Professional Purposes",
            "philosophy": "Philosophy",
            "hope": "Health Optimizing Physical Education",
            "pr": "Practical Research"
        };
        const finalSubject = subject === 'others' ? subjectName : (subjectFullNames[subject] || subject);

        const user = await getUser();
        if (!user) {
            alert('Login first.');
            return;
        }

        try {
            await supabase.from('tasks').insert([{
                user_id: user.id,
                activity,
                subject: finalSubject,
                deadline: date,
                status: 'Ongoing'
            }]);
            $('.taskTable input[type="text"]').val('');
            $('.taskTable select').val('select');
            $('.taskTable input[type="date"]').val('');
            $subjectNameInput.hide();
            loadTasks();
        } catch (err) {
            console.error(err);
            alert('Failed to add task.');
        }
    };

    // ======== LOAD TASKS (hide done tasks, case-insensitive) ========
    async function loadTasks() {
        const user = await getUser();
        if (!user) return;

        const { data: tasks = [], error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('deadline', { ascending: true });

        if (error) {
            console.error(error);
            return;
        }

        const visibleTasks = tasks.filter(t => (t.status || '').toLowerCase() !== 'done');
        const doneCount = tasks.filter(t => (t.status || '').toLowerCase() === 'done').length;
        const ongoingCount = tasks.filter(t => (t.status || '').toLowerCase() === 'ongoing').length;
        $('#tasksDone').text(doneCount);
        $('#tasksOngoing').text(ongoingCount);

        const $tbody = $('.tasks-table tbody');
        const $mobileContainer = $('#taskCardsContainer');
        $tbody.empty();
        $mobileContainer.empty();

        if (!visibleTasks.length) {
            $tbody.append('<tr><td colspan="5">No tasks found.</td></tr>');
            $mobileContainer.html('<p style="text-align:center;">No tasks found.</p>');
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        visibleTasks.forEach(task => {
            let statusColor = task.deadline < today ? 'red' : 'orange';

            $tbody.append(`
                <tr data-id-row="${task.id}">
                    <td>${task.activity}</td>
                    <td>${task.subject}</td>
                    <td>${task.deadline}</td>
                    <td style="color:${statusColor}; font-weight:bold;">${task.status}</td>
                    <td style="text-align:center;">
                        <button class="doneTaskBtn" data-id="${task.id}" style="background-color:#4CAF50;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;margin-right:6px;">Done</button>
                        <button class="deleteTaskBtn" data-id="${task.id}" style="background-color:#f44336;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;">Delete</button>
                    </td>
                </tr>
            `);

            $mobileContainer.append(`
                <div class="task-card-item" data-id="${task.id}">
                    <h3>${task.activity}</h3>
                    <p><strong>Subject:</strong> ${task.subject}</p>
                    <p><em>Deadline:</em> ${task.deadline}</p>
                    <p><em>Status:</em> <span style="color:${statusColor}; font-weight:bold;">${task.status}</span></p>
                    <div class="card-buttons" style="text-align:center;">
                        <button class="doneTaskBtn" data-id="${task.id}">Done</button>
                        <button class="deleteTaskBtn" data-id="${task.id}">Delete</button>
                    </div>
                </div>
            `);
        });

        $('.doneTaskBtn').off('click').on('click', async function () {
            const id = $(this).data('id');
            try {
                const { error } = await supabase.from('tasks').update({ status: 'Done' }).eq('id', id);
                if (error) throw error;
                $(`tr[data-id-row="${id}"]`).remove();
                $(`.task-card-item[data-id="${id}"]`).remove();
                const currentDone = parseInt($('#tasksDone').text() || '0', 10) + 1;
                const currentOngoing = Math.max(0, parseInt($('#tasksOngoing').text() || '0', 10) - 1);
                $('#tasksDone').text(currentDone);
                $('#tasksOngoing').text(currentOngoing);
                if ($('.tasks-table tbody tr').length === 0 && $('#taskCardsContainer').children().length === 0) {
                    $('.tasks-table tbody').append('<tr><td colspan="5">No tasks found.</td></tr>');
                    $('#taskCardsContainer').html('<p style="text-align:center;">No tasks found.</p>');
                }
            } catch (err) {
                console.error(err);
                alert('Failed to mark task done.');
            }
        });

        $('.deleteTaskBtn').off('click').on('click', async function () {
            const id = $(this).data('id');
            if (!confirm('Delete this task?')) return;
            try {
                const { error } = await supabase.from('tasks').delete().eq('id', id);
                if (error) throw error;
                $(`tr[data-id-row="${id}"]`).remove();
                $(`.task-card-item[data-id="${id}"]`).remove();
                const currentOngoing = Math.max(0, parseInt($('#tasksOngoing').text() || '0', 10) - 1);
                $('#tasksOngoing').text(currentOngoing);
                if ($('.tasks-table tbody tr').length === 0 && $('#taskCardsContainer').children().length === 0) {
                    $('.tasks-table tbody').append('<tr><td colspan="5">No tasks found.</td></tr>');
                    $('#taskCardsContainer').html('<p style="text-align:center;">No tasks found.</p>');
                }
            } catch (err) {
                console.error(err);
                alert('Failed to delete task.');
            }
        });

        if (window.innerWidth <= 768) {
            $('.tasks-table').hide();
            $mobileContainer.show();
        } else {
            $('.tasks-table').show();
            $mobileContainer.hide();
        }
    }

    $(window).on('resize', loadTasks);
});
