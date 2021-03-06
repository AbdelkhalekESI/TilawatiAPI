'use strict';
const Hash = use('Hash');
const User = use('App/Models/User');
const { validate } = use('Validator');
const Database = use('Database');
const Helpers = use('Helpers');
const Env = use('Env');

class UserController {
	async register({ request, auth, response }) {
		const validation = await validate(request.all(), {
			first_name: 'required|min:3|max:50',
			last_name: 'required|min:3|max:50',
			email: 'required|email|unique:users',
			password: 'required|min:8|max:50|confirmed'
		});

		if (validation.fails()) {
			console.log(validation.message);
			return response.status(403).json(validation.messages());
		}

		let user = new User();
		user.first_name = request.input('first_name');
		user.last_name = request.input('last_name');
		user.email = request.input('email');
		user.password = request.input('password');
		const photo = request.file('photo', {
			types: [ 'image' ]
		});

		user.photo = user.first_name + '.' + photo.extname;
		await photo.move(Helpers.publicPath('uploads/photos'), {
			name: user.photo
		});

		if (!photo.moved()) {
			return photo.error();
		}
		await user.save();

		let accessToken = await auth.generate(user);

		return response.status(200).json({
			user: user,
			accessToken: accessToken
		});
	}

	async login({ auth, request, response }) {
		const validation = await validate(request.all(), {
			email: 'required',
			password: 'required'
		});

		if (validation.fails()) {
			return response.status(403).json(validation.messages());
		}

		const email = request.input('email');
		const password = request.input('password');
		try {
			if (await auth.attempt(email, password)) {
				let user = await User.findBy('email', email);
				let accessToken = await auth.generate(user);
				return response.status(200).json({
					user: user,
					accessToken: accessToken
				});
			}
		} catch (e) {
			return response.status(403).json([
				{
					message: 'Email and password does not match with any account !'
				}
			]);
		}
	}
	async update({ auth, request, response }) {
		const validation = await validate(request.all(), {
			first_name: 'min:3|max:50',
			last_name: 'min:3|max:50',
			email: 'email|unique:users'
		});

		if (validation.fails()) {
			console.log(validation.message);
			return response.status(403).json(validation.messages());
		}

		try {
			// get currently authenticated user
			//console.log(auth.currentUser)
			const user = await auth.user;

			// update with new data entered
			user.first_name = request.input('first_name');
			user.last_name = request.input('last_name');
			user.email = request.input('email');
			//user.password = request.input('password')

			await user.save();

			return response.json({
				status: 'success',
				message: 'Profile updated!',
				data: user
			});
		} catch (error) {
			console.log(error);
			return response.status(400).json({
				status: 'error',
				message: 'There was a problem updating profile, please try again later.'
			});
		}
	}

	async updatePassword({ auth, request, response }) {
		// get currently authenticated user
		const user = await auth.user;

		// verify if current password matches
		const verifyPassword = await Hash.verify(request.input('password'), user.password);

		// display appropriate message
		if (!verifyPassword) {
			return response.status(400).json({
				status: 'error',
				message: 'Current password could not be verified! Please try again.'
			});
		}

		const validation = await validate(request.all(), {
			password: 'required|min:8|max:50|confirmed'
		});

		try {
			// hash and save new password
			user.password = request.input('new_password');
			await user.save();

			console.log(user.password);

			return response.json({
				status: 'success',
				message: 'Password updated!'
			});
		} catch (error) {
			return response.status(400).json({
				status: 'error',
				message: 'There was a problem updating profile, please try again later.'
			});
		}
	}

	async search({ request, response }) {
		const query = request.input('q');
		const users1 = await Database.table('users').where('first_name', 'like', `%${query}%`);
		const users2 = await Database.table('users').where('last_name', 'like', `%${query}%`);
		const users = [ ...users1, ...users2 ];
		return response.json({
			data: users
		});
	}

	async getAuthUser({ auth, request, response }) {
		const user = await auth.user;
		if (!user) return response.status(404);
		user.photo = Env.get('APP_URL') + '/uploads/photos/' + encodeURI(user.photo);
		user.name = user.first_name + ' ' + user.last_name;
		return response.json({
			data: user
		});
	}
}

module.exports = UserController;
